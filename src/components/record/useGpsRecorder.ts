"use client";

import { useCallback, useRef, useState } from "react";
import { haversine } from "@/lib/geo";

export type GpsStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "reviewing"
  | "denied"
  | "unavailable";

export type Fix = { lng: number; lat: number; accuracy: number };

export type PositionSource = {
  watch(
    onFix: (fix: Fix) => void,
    onFatal: (reason: "denied" | "unavailable") => void,
    onSearching: (searching: boolean) => void,
  ): () => void;
};

const MAX_ACCURACY_M = 50; // drop fixes worse than this
const MIN_STEP_M = 5; // dedupe jitter below this
const SNAPSHOT_KEY = "michi-gps-draft";
const SNAPSHOT_EVERY = 10;

function geolocationSource(): PositionSource {
  return {
    watch(onFix, onFatal, onSearching) {
      if (!("geolocation" in navigator)) {
        onFatal("unavailable");
        return () => {};
      }
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          onSearching(false);
          onFix({
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) onFatal("denied");
          // UNAVAILABLE / TIMEOUT are transient outdoors: keep watching.
          else onSearching(true);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
      return () => navigator.geolocation.clearWatch(id);
    },
  };
}

// Philosopher's Path replay for desk development (also via localStorage flag).
const MOCK_TRACK: [number, number][] = Array.from({ length: 30 }, (_, i) => {
  const t = i / 29;
  return [
    135.7942 + 0.0009 * Math.sin(t * 6) + 0.0004 * t,
    35.0268 - 0.0157 * t,
  ] as [number, number];
});

function mockSource(): PositionSource {
  return {
    watch(onFix) {
      let i = 0;
      const timer = setInterval(() => {
        if (i >= MOCK_TRACK.length) {
          clearInterval(timer);
          return;
        }
        const [lng, lat] = MOCK_TRACK[i++];
        onFix({ lng, lat, accuracy: 8 });
      }, 700);
      return () => clearInterval(timer);
    },
  };
}

function defaultSource(): PositionSource {
  const mock =
    process.env.NEXT_PUBLIC_MOCK_GEO === "1" ||
    (typeof window !== "undefined" &&
      localStorage.getItem("michi-mock-geo") === "1");
  return mock ? mockSource() : geolocationSource();
}

type Snapshot = { points: [number, number][]; activeMs: number };

function readSnapshot(): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    return Array.isArray(parsed.points) && parsed.points.length > 0
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function useGpsRecorder(source?: PositionSource) {
  const [status, setStatus] = useState<GpsStatus>("idle");
  const [points, setPoints] = useState<[number, number][]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [searching, setSearching] = useState(false);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [snapshotAvailable, setSnapshotAvailable] = useState<boolean>(() =>
    typeof window === "undefined" ? false : readSnapshot() !== null,
  );

  const stopRef = useRef<(() => void) | null>(null);
  const pointsRef = useRef<[number, number][]>([]);
  const distanceRef = useRef(0);
  const activeMsRef = useRef(0);
  const segStartRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const beginWatch = useCallback(() => {
    setStatus("requesting");
    const src = source ?? defaultSource();
    stopRef.current = src.watch(
      (fix) => {
        setStatus("recording");
        if (segStartRef.current === null) segStartRef.current = Date.now();
        setPosition([fix.lng, fix.lat]);
        if (fix.accuracy > MAX_ACCURACY_M) return;
        const pts = pointsRef.current;
        const point: [number, number] = [fix.lng, fix.lat];
        if (pts.length > 0) {
          const step = haversine(pts[pts.length - 1], point);
          if (step < MIN_STEP_M) return;
          distanceRef.current += step;
        }
        pointsRef.current = [...pts, point];
        setPoints(pointsRef.current);
        setDistanceM(Math.round(distanceRef.current));
        if (pointsRef.current.length % SNAPSHOT_EVERY === 0) {
          const activeMs =
            activeMsRef.current +
            (segStartRef.current ? Date.now() - segStartRef.current : 0);
          try {
            sessionStorage.setItem(
              SNAPSHOT_KEY,
              JSON.stringify({ points: pointsRef.current, activeMs }),
            );
          } catch {
            // storage full/unavailable: recording continues without snapshots
          }
        }
      },
      (reason) => {
        stopRef.current?.();
        stopRef.current = null;
        setStatus(reason);
      },
      setSearching,
    );
    // Keep the screen on while recording; geolocation dies when it sleeps.
    navigator.wakeLock
      ?.request("screen")
      .then((lock) => {
        wakeLockRef.current = lock;
      })
      .catch(() => {});
  }, [source]);

  const closeSegment = useCallback(() => {
    if (segStartRef.current !== null) {
      activeMsRef.current += Date.now() - segStartRef.current;
      segStartRef.current = null;
    }
    stopRef.current?.();
    stopRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const start = useCallback(() => {
    pointsRef.current = [];
    distanceRef.current = 0;
    activeMsRef.current = 0;
    segStartRef.current = null;
    setPoints([]);
    setDistanceM(0);
    beginWatch();
  }, [beginWatch]);

  const resumeSnapshot = useCallback(() => {
    const snap = readSnapshot();
    if (!snap) return;
    pointsRef.current = snap.points;
    activeMsRef.current = snap.activeMs;
    let d = 0;
    for (let i = 1; i < snap.points.length; i++) {
      d += haversine(snap.points[i - 1], snap.points[i]);
    }
    distanceRef.current = d;
    setPoints(snap.points);
    setDistanceM(Math.round(d));
    beginWatch();
  }, [beginWatch]);

  const pause = useCallback(() => {
    closeSegment();
    setStatus("paused");
  }, [closeSegment]);

  const resume = useCallback(() => {
    beginWatch();
  }, [beginWatch]);

  const finish = useCallback(() => {
    closeSegment();
    setStatus("reviewing");
  }, [closeSegment]);

  const discard = useCallback(() => {
    closeSegment();
    pointsRef.current = [];
    setPoints([]);
    setDistanceM(0);
    setPosition(null);
    setStatus("idle");
    try {
      sessionStorage.removeItem(SNAPSHOT_KEY);
      setSnapshotAvailable(false);
    } catch {}
  }, [closeSegment]);

  const clearSnapshot = useCallback(() => {
    try {
      sessionStorage.removeItem(SNAPSHOT_KEY);
    } catch {}
    setSnapshotAvailable(false);
  }, []);

  return {
    status,
    points,
    distanceM,
    searching,
    position,
    snapshotAvailable,
    durationS: () =>
      Math.round(
        (activeMsRef.current +
          (segStartRef.current ? Date.now() - segStartRef.current : 0)) /
          1000,
      ),
    start,
    pause,
    resume,
    finish,
    discard,
    resumeSnapshot,
    clearSnapshot,
  };
}

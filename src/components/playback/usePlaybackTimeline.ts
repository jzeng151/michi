"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { MapRef } from "react-map-gl/maplibre";
import {
  bearingAtFraction,
  cumulativeDistances,
  nearestFraction,
  pointAtFraction,
  shortestArcDelta,
} from "@/lib/geo";
import type { LineString, MediaPin } from "@/lib/types";

export type PlaybackStatus = "ready" | "playing" | "media" | "paused" | "ended";

export type Stop = MediaPin & { frac: number };

const WALK_SPEED_M_PER_S = 25; // playback meters per real second
const MIN_DURATION_S = 20;
const MAX_DURATION_S = 90;
const PHOTO_HOLD_S = 3;
const BEARING_SMOOTHING = 0.08; // low-pass factor to kill jitter spin
const CAMERA = { pitch: 55, zoom: 16.5 };

/**
 * GSAP owns the easing: one timeline animates a {t} proxy and every tick
 * calls map.jumpTo (never easeTo/flyTo, which would fight the timeline).
 * Media stops pause the flight: photos hold for a beat, audio plays out.
 */
export function usePlaybackTimeline({
  path,
  media,
  getMap,
  progressElRef,
}: {
  path: LineString;
  media: MediaPin[];
  getMap: () => MapRef | null;
  /** Range input updated imperatively each tick (no React re-renders in flight). */
  progressElRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [status, setStatus] = useState<PlaybackStatus>("ready");
  const [activeStop, setActiveStop] = useState<Stop | null>(null);

  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const delayedRef = useRef<gsap.core.Tween | null>(null);
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const bearingRef = useRef<number | null>(null);

  const cumulative = useMemo(
    () => cumulativeDistances(path.coordinates),
    [path],
  );

  const stops: Stop[] = useMemo(
    () =>
      media
        .map((m) => ({
          ...m,
          frac: nearestFraction(path, cumulative, [m.lng, m.lat]),
        }))
        .sort((a, b) => a.frac - b.frac),
    [media, path, cumulative],
  );

  const clearPending = useCallback(() => {
    delayedRef.current?.kill();
    delayedRef.current = null;
    audiosRef.current.forEach((a) => a.pause());
    setActiveStop(null);
  }, []);

  const start = useCallback(() => {
    const map = getMap();
    if (!map || timelineRef.current) return;

    // Create and load audio inside this user gesture to satisfy autoplay
    // policies before playback reaches the pins.
    stops.forEach((s) => {
      if (s.kind === "audio" && s.url && !audiosRef.current.has(s.id)) {
        const audio = new Audio(s.url);
        audio.preload = "auto";
        audio.load();
        audiosRef.current.set(s.id, audio);
      }
    });

    const total = cumulative[cumulative.length - 1];
    const duration = Math.min(
      MAX_DURATION_S,
      Math.max(MIN_DURATION_S, total / WALK_SPEED_M_PER_S),
    );
    const proxy = { t: 0 };
    bearingRef.current = null;

    const tl = gsap.timeline({
      paused: true,
      onUpdate: () => {
        const t = proxy.t;
        const center = pointAtFraction(path, cumulative, t);
        const raw = bearingAtFraction(path, cumulative, t);
        const prev = bearingRef.current;
        const bearing =
          prev === null
            ? raw
            : prev + shortestArcDelta(prev, raw) * BEARING_SMOOTHING;
        bearingRef.current = bearing;
        map.jumpTo({ center, bearing, ...CAMERA });
        if (progressElRef.current) {
          const v = String(Math.round(t * 1000));
          progressElRef.current.value = v;
          progressElRef.current.setAttribute("aria-valuenow", v);
        }
      },
      onComplete: () => {
        clearPending();
        setStatus("ended");
      },
    });
    tl.to(proxy, { t: 1, duration, ease: "none" }, 0);

    stops.forEach((stop) => {
      tl.addPause(stop.frac * duration, () => {
        setStatus("media");
        setActiveStop(stop);
        const resume = () => {
          delayedRef.current = null;
          setActiveStop(null);
          setStatus("playing");
          tl.play();
        };
        if (stop.kind === "audio") {
          const audio = audiosRef.current.get(stop.id);
          if (audio) {
            audio.currentTime = 0;
            audio.onended = resume;
            audio.onerror = resume;
            audio.play().catch(() => {
              delayedRef.current = gsap.delayedCall(PHOTO_HOLD_S, resume);
            });
          } else {
            delayedRef.current = gsap.delayedCall(PHOTO_HOLD_S, resume);
          }
        } else {
          delayedRef.current = gsap.delayedCall(PHOTO_HOLD_S, resume);
        }
      });
    });

    timelineRef.current = tl;
    map.jumpTo({
      center: path.coordinates[0],
      bearing: bearingAtFraction(path, cumulative, 0),
      ...CAMERA,
    });
    setStatus("playing");
    tl.play();
  }, [getMap, stops, cumulative, path, clearPending, progressElRef]);

  const pause = useCallback(() => {
    clearPending();
    timelineRef.current?.pause();
    setStatus("paused");
  }, [clearPending]);

  const resume = useCallback(() => {
    if (!timelineRef.current) return;
    setStatus("playing");
    timelineRef.current.play();
  }, []);

  const replay = useCallback(() => {
    clearPending();
    bearingRef.current = null;
    timelineRef.current?.progress(0).pause();
    setStatus("playing");
    timelineRef.current?.play();
  }, [clearPending]);

  /** value in 0..1000 from the range input. */
  const scrub = useCallback(
    (value: number) => {
      const tl = timelineRef.current;
      if (!tl) return;
      clearPending();
      tl.pause();
      bearingRef.current = null;
      tl.progress(value / 1000);
      setStatus("paused");
    },
    [clearPending],
  );

  // Teardown: kill the timeline and audio when the overlay unmounts.
  useEffect(() => {
    const audios = audiosRef.current;
    return () => {
      delayedRef.current?.kill();
      timelineRef.current?.kill();
      timelineRef.current = null;
      audios.forEach((a) => {
        a.pause();
        a.src = "";
      });
      audios.clear();
    };
  }, []);

  return {
    status,
    activeStop,
    stops,
    start,
    pause,
    resume,
    replay,
    scrub,
  };
}

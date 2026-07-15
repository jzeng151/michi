"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { Marker as MarkerInstance } from "maplibre-gl";
import type { MapRef } from "react-map-gl/maplibre";
import {
  bearingAtFraction,
  cumulativeDistances,
  nearestFraction,
  pointAtFraction,
  shortestArcDelta,
} from "@/lib/geo";
import {
  activeStopAtProgress,
  clampProgress,
  cursorAfterSeek,
  dueStopIndex,
  fillStopFractions,
  playbackDuration,
  playbackHoldDuration,
  type PlaybackSpeed,
} from "@/lib/playback";
import type { ReplayEntry } from "@/lib/layered-memory";
import type { LineString } from "@/lib/types";

export type PlaybackStatus = "ready" | "playing" | "media" | "paused" | "ended";

export type Stop = ReplayEntry & { frac: number };

const BEARING_SMOOTHING = 0.08;
const CAMERA = { pitch: 55, zoom: 16.5 };

/**
 * GSAP owns route progress. Camera, marker, and range updates stay imperative,
 * so a frame never needs a React render; React state changes only at controls
 * and stop boundaries.
 */
export function usePlaybackTimeline({
  path,
  entries,
  getMap,
  markerRef,
  progressElRef,
}: {
  path: LineString;
  entries: ReplayEntry[];
  getMap: () => MapRef | null;
  markerRef: React.RefObject<MarkerInstance | null>;
  progressElRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [status, setStatus] = useState<PlaybackStatus>("ready");
  const [activeStop, setActiveStop] = useState<Stop | null>(null);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);

  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const delayedRef = useRef<gsap.core.Tween | null>(null);
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeStopRef = useRef<Stop | null>(null);
  const fallbackHoldRef = useRef<(() => void) | null>(null);
  const nextStopRef = useRef(0);
  const speedRef = useRef<PlaybackSpeed>(1);
  const bearingRef = useRef<number | null>(null);
  const mediaGenerationRef = useRef(0);
  const audioAttemptRef = useRef(0);
  const pausedRef = useRef(false);
  const stopEventRef = useRef(0);
  const renderFrameRef = useRef<(progress: number) => void>(() => {});

  const cumulative = useMemo(
    () => cumulativeDistances(path.coordinates),
    [path],
  );

  const stops: Stop[] = useMemo(() => {
    const rawFractions = entries.map((stop) =>
      stop.lng === null || stop.lat === null
        ? null
        : nearestFraction(path, cumulative, [stop.lng, stop.lat]),
    );
    const fractions = fillStopFractions(rawFractions);
    return entries.map((stop, index) => ({ ...stop, frac: fractions[index] }));
  }, [entries, path, cumulative]);

  const clearActiveStop = useCallback(() => {
    mediaGenerationRef.current += 1;
    audioAttemptRef.current += 1;
    delayedRef.current?.kill();
    delayedRef.current = null;
    const audio = activeAudioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
    }
    activeAudioRef.current = null;
    fallbackHoldRef.current = null;
    activeStopRef.current = null;
    setActiveStop(null);
  }, []);

  const start = useCallback(() => {
    const map = getMap();
    if (!map || timelineRef.current) return;

    // Load audio during the initiating user gesture for autoplay policies.
    stops.forEach((stop) => {
      if (stop.kind === "audio" && stop.url && !audiosRef.current.has(stop.id)) {
        const audio = new Audio(stop.url);
        audio.preload = "auto";
        audio.load();
        audiosRef.current.set(stop.id, audio);
      }
    });

    const total = cumulative[cumulative.length - 1];
    const proxy = { progress: 0 };
    bearingRef.current = null;
    nextStopRef.current = 0;
    pausedRef.current = false;

    const renderFrame = (value: number) => {
      const progress = clampProgress(value);
      const center = pointAtFraction(path, cumulative, progress);
      const rawBearing = bearingAtFraction(path, cumulative, progress);
      const previousBearing = bearingRef.current;
      const bearing =
        previousBearing === null
          ? rawBearing
          : previousBearing +
            shortestArcDelta(previousBearing, rawBearing) * BEARING_SMOOTHING;
      bearingRef.current = bearing;
      map.jumpTo({ center, bearing, ...CAMERA });
      const nextValue = String(Math.round(progress * 1000));
      const marker = markerRef.current;
      if (marker) {
        marker.setLngLat(center);
        const position = marker.getLngLat();
        const element = marker.getElement();
        element.setAttribute("data-playback-progress", nextValue);
        element.setAttribute("data-playback-lng", String(position.lng));
        element.setAttribute("data-playback-lat", String(position.lat));
      }
      if (progressElRef.current) {
        progressElRef.current.value = nextValue;
        progressElRef.current.setAttribute("aria-valuenow", nextValue);
      }
    };
    renderFrameRef.current = renderFrame;

    function scheduleFinish(generation: number, duration: number) {
      if (delayedRef.current) return;
      const delay = gsap.delayedCall(duration, () => {
        if (delayedRef.current === delay) delayedRef.current = null;
        finishStop(generation);
      });
      delayedRef.current = delay;
      if (pausedRef.current) delay.pause();
    }

    function finishStop(generation: number) {
      if (
        generation !== mediaGenerationRef.current ||
        !activeStopRef.current
      ) {
        return;
      }
      if (pausedRef.current) {
        scheduleFinish(generation, 0);
        return;
      }
      mediaGenerationRef.current += 1;
      audioAttemptRef.current += 1;
      delayedRef.current = null;
      const audio = activeAudioRef.current;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
      }
      activeAudioRef.current = null;
      fallbackHoldRef.current = null;
      activeStopRef.current = null;
      setActiveStop(null);
      const due = dueStopIndex(stops, nextStopRef.current, proxy.progress);
      if (due !== null) {
        nextStopRef.current = due + 1;
        openStop(stops[due]);
        return;
      }
      if (proxy.progress >= 1) {
        setStatus("ended");
        return;
      }
      setStatus("playing");
      timeline.play();
    }

    function fallbackHold(generation: number) {
      if (
        generation !== mediaGenerationRef.current ||
        !activeStopRef.current ||
        delayedRef.current
      ) {
        return;
      }
      const audio = activeAudioRef.current;
      if (audio) {
        audioAttemptRef.current += 1;
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
      }
      activeAudioRef.current = null;
      scheduleFinish(generation, playbackHoldDuration(speedRef.current));
    }

    function openStop(stop: Stop) {
      const generation = ++mediaGenerationRef.current;
      pausedRef.current = false;
      timeline.pause();
      renderFrame(stop.frac);
      activeStopRef.current = stop;
      fallbackHoldRef.current = () => fallbackHold(generation);
      setActiveStop(stop);
      setStatus("media");
      const markerElement = markerRef.current?.getElement();
      if (markerElement) {
        stopEventRef.current += 1;
        markerElement.setAttribute("data-playback-stop", stop.id);
        markerElement.setAttribute(
          "data-playback-stop-event",
          String(stopEventRef.current),
        );
      }

      if (stop.kind === "audio") {
        const audio = audiosRef.current.get(stop.id);
        if (audio) {
          activeAudioRef.current = audio;
          audio.currentTime = 0;
          audio.playbackRate = speedRef.current;
          audio.onended = () => finishStop(generation);
          audio.onerror = () => fallbackHold(generation);
          const attempt = ++audioAttemptRef.current;
          void audio.play().catch(() => {
            if (attempt === audioAttemptRef.current) {
              fallbackHold(generation);
            }
          });
          return;
        }
      }
      fallbackHold(generation);
    }

    const timeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        renderFrame(proxy.progress);
        if (activeStopRef.current) return;
        const due = dueStopIndex(stops, nextStopRef.current, proxy.progress);
        if (due !== null) {
          nextStopRef.current = due + 1;
          openStop(stops[due]);
        }
      },
      onComplete: () => {
        if (activeStopRef.current) return;
        clearActiveStop();
        setStatus("ended");
      },
    });
    timeline.to(proxy, {
      progress: 1,
      duration: playbackDuration(total, 1),
      ease: "none",
    });
    timeline.timeScale(speedRef.current);
    timelineRef.current = timeline;

    renderFrame(0);
    setStatus("playing");
    timeline.play();
  }, [
    clearActiveStop,
    cumulative,
    getMap,
    markerRef,
    path,
    progressElRef,
    stops,
  ]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    audioAttemptRef.current += 1;
    timelineRef.current?.pause();
    delayedRef.current?.pause();
    activeAudioRef.current?.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    pausedRef.current = false;
    if (delayedRef.current) {
      setStatus("media");
      delayedRef.current.resume();
      return;
    }
    if (activeAudioRef.current) {
      const audio = activeAudioRef.current;
      const generation = mediaGenerationRef.current;
      const attempt = ++audioAttemptRef.current;
      setStatus("media");
      void audio.play().catch(() => {
        if (
          attempt !== audioAttemptRef.current ||
          generation !== mediaGenerationRef.current ||
          activeAudioRef.current !== audio
        ) {
          return;
        }
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        activeAudioRef.current = null;
        fallbackHoldRef.current?.();
      });
      return;
    }
    if (activeStopRef.current) clearActiveStop();
    if (timeline.progress() >= 1) {
      setStatus("ended");
      return;
    }
    setStatus("playing");
    timeline.play();
  }, [clearActiveStop]);

  const replay = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    clearActiveStop();
    pausedRef.current = false;
    bearingRef.current = null;
    nextStopRef.current = 0;
    timeline.progress(0, true).pause();
    renderFrameRef.current(0);
    setStatus("playing");
    timeline.play();
  }, [clearActiveStop]);

  /** Slider value in 0..1000. Seeking never runs crossed GSAP callbacks. */
  const scrub = useCallback(
    (value: number) => {
      const timeline = timelineRef.current;
      if (!timeline) return;
      const progress = clampProgress(value / 1000);
      clearActiveStop();
      pausedRef.current = true;
      timeline.progress(progress, true).pause();
      bearingRef.current = null;
      renderFrameRef.current(progress);
      nextStopRef.current = cursorAfterSeek(stops, progress);
      const activeIndex = activeStopAtProgress(stops, progress);
      if (activeIndex !== null) {
        activeStopRef.current = stops[activeIndex];
        setActiveStop(stops[activeIndex]);
      }
      setStatus("paused");
    },
    [clearActiveStop, stops],
  );

  const seekStop = useCallback(
    (index: number) => {
      const timeline = timelineRef.current;
      const stop = stops[index];
      if (!timeline || !stop) return;
      clearActiveStop();
      pausedRef.current = true;
      timeline.progress(stop.frac, true).pause();
      bearingRef.current = null;
      renderFrameRef.current(stop.frac);
      nextStopRef.current = index + 1;
      activeStopRef.current = stop;
      setActiveStop(stop);
      setStatus("paused");
    },
    [clearActiveStop, stops],
  );

  const setSpeed = useCallback((next: PlaybackSpeed) => {
    const previous = speedRef.current;
    speedRef.current = next;
    setSpeedState(next);
    timelineRef.current?.timeScale(next);
    if (delayedRef.current) {
      delayedRef.current.timeScale(
        delayedRef.current.timeScale() * (next / previous),
      );
    }
    if (activeAudioRef.current) activeAudioRef.current.playbackRate = next;
  }, []);

  useEffect(() => {
    const audios = audiosRef.current;
    return () => {
      mediaGenerationRef.current += 1;
      audioAttemptRef.current += 1;
      pausedRef.current = true;
      delayedRef.current?.kill();
      delayedRef.current = null;
      timelineRef.current?.kill();
      timelineRef.current = null;
      activeAudioRef.current = null;
      activeStopRef.current = null;
      fallbackHoldRef.current = null;
      audios.forEach((audio) => {
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        audio.src = "";
      });
      audios.clear();
    };
  }, []);

  return {
    status,
    activeStop,
    speed,
    stops,
    start,
    pause,
    resume,
    replay,
    scrub,
    seekStop,
    setSpeed,
  };
}

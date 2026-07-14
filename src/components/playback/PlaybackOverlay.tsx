"use client";

import { forwardRef, memo, useEffect, useRef, useState } from "react";
import type { Marker as MarkerInstance } from "maplibre-gl";
import { Marker, type MapRef } from "react-map-gl/maplibre";
import { MapCanvas } from "@/components/map/MapCanvas";
import { RouteLayer } from "@/components/map/RouteLayer";
import { isHeicMime } from "@/lib/media-url";
import { PLAYBACK_SPEEDS } from "@/lib/playback";
import type { LineString, WalkStop } from "@/lib/types";
import { StepThrough } from "./StepThrough";
import { usePlaybackTimeline, type Stop } from "./usePlaybackTimeline";

export type PlaybackMode = "cinematic" | "steps";

const controlButton =
  "rounded-full border border-line bg-surface px-4 py-2 text-sm transition-colors hover:bg-wash";

const PlaybackMarker = memo(
  forwardRef<MarkerInstance, { longitude: number; latitude: number }>(
    function PlaybackMarker({ longitude, latitude }, ref) {
      return (
        <Marker ref={ref} longitude={longitude} latitude={latitude}>
          <span
            aria-hidden="true"
            className="block h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent shadow"
          />
        </Marker>
      );
    },
  ),
);

export function PlaybackOverlay({
  title,
  path,
  media,
  initialMode,
  onExit,
}: {
  title: string;
  path: LineString | null;
  media: WalkStop[];
  initialMode: PlaybackMode;
  onExit: () => void;
}) {
  const [mode] = useState<PlaybackMode>(() =>
    !path ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      ? "steps"
      : initialMode,
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>("[data-autofocus]")
      ?.focus();
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onExit]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusables = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Walk playback: ${title}`}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-40 flex flex-col bg-canvas"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
        <p className="truncate font-display text-lg font-semibold">{title}</p>
        <button
          type="button"
          data-autofocus
          onClick={onExit}
          className={controlButton}
        >
          ✕ Exit
        </button>
      </header>

      {mode === "steps" || !path ? (
        <div className="min-h-0 flex-1">
          <StepThrough title={title} path={path} media={media} />
        </div>
      ) : (
        <CinematicPlayback
          title={title}
          path={path}
          media={media}
          onExit={onExit}
        />
      )}
    </div>
  );
}

function CinematicPlayback({
  title,
  path,
  media,
  onExit,
}: {
  title: string;
  path: LineString;
  media: WalkStop[];
  onExit: () => void;
}) {
  const renderCount = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);
  const markerRef = useRef<MarkerInstance>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const playbackControlRef = useRef<HTMLButtonElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const playback = usePlaybackTimeline({
    path,
    media,
    getMap: () => mapRef.current,
    markerRef,
    progressElRef: progressRef,
  });
  const { status, activeStop } = playback;
  const [lng, lat] = path.coordinates[0];

  useEffect(() => {
    renderCount.current += 1;
    containerRef.current?.setAttribute(
      "data-playback-render-count",
      String(renderCount.current),
    );
  });

  useEffect(() => {
    const focused = document.activeElement;
    if (focused && focused !== document.body && focused.isConnected) return;
    if (status === "ended") replayRef.current?.focus();
    else if (status !== "ready") playbackControlRef.current?.focus();
  }, [status]);

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1">
      <MapCanvas
        ref={mapRef}
        label={`Playback map: ${title}`}
        initialViewState={{ longitude: lng, latitude: lat, zoom: 15 }}
        hideControls
        dragPan={false}
        dragRotate={false}
        scrollZoom={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        keyboard={false}
      >
        <RouteLayer path={path} />
        <PlaybackMarker ref={markerRef} longitude={lng} latitude={lat} />
      </MapCanvas>

      {status === "ready" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/40">
          <button
            type="button"
            onClick={playback.start}
            className="rounded-full bg-accent px-8 py-4 text-lg font-medium text-accent-ink shadow-lg transition-transform hover:scale-105"
          >
            ▶ Begin walk
          </button>
        </div>
      )}

      <div
        aria-live="polite"
        className="absolute inset-x-0 bottom-32 z-10 flex justify-center px-4"
      >
        {activeStop && <StopPopup stop={activeStop} />}
      </div>

      {status === "ended" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-canvas/40">
          <p className="font-display text-2xl">
            {title} <span aria-hidden="true">·</span> walked
          </p>
          <div className="flex gap-2">
            <button
              ref={replayRef}
              type="button"
              onClick={playback.replay}
              className="rounded-full bg-accent px-6 py-3 font-medium text-accent-ink"
            >
              ↺ Replay
            </button>
            <button type="button" onClick={onExit} className={controlButton}>
              Exit
            </button>
          </div>
        </div>
      )}

      {status !== "ready" && status !== "ended" && (
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-4 py-3">
          {playback.stops.length > 0 && (
            <ol
              aria-label="Stop timeline"
              className="mb-3 flex gap-2 overflow-x-auto pb-1"
            >
              {playback.stops.map((stop, index) => (
                <li key={stop.id} className="shrink-0">
                  <button
                    type="button"
                    data-stop-id={stop.id}
                    onClick={() => playback.seekStop(index)}
                    aria-current={activeStop?.id === stop.id ? "step" : undefined}
                    className="rounded-full border border-line px-3 py-1 text-xs transition-colors hover:bg-wash aria-[current=step]:border-accent aria-[current=step]:bg-wash"
                  >
                    {index + 1}. {stopKind(stop)}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="flex items-center gap-3">
            {status === "playing" || status === "media" ? (
              <button
                ref={playbackControlRef}
                type="button"
                onClick={playback.pause}
                aria-label="Pause playback"
                className={controlButton}
              >
                ⏸
              </button>
            ) : (
              <button
                ref={playbackControlRef}
                type="button"
                onClick={playback.resume}
                aria-label="Resume playback"
                className={controlButton}
              >
                ▶
              </button>
            )}
            <input
              ref={progressRef}
              type="range"
              min={0}
              max={1000}
              defaultValue={0}
              aria-label="Playback position"
              onChange={(event) => playback.scrub(Number(event.target.value))}
              className="min-w-0 flex-1 accent-[var(--accent)]"
            />
            <div
              role="group"
              aria-label="Playback speed"
              className="flex shrink-0 rounded-full border border-line bg-canvas p-0.5"
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  aria-pressed={playback.speed === speed}
                  onClick={() => playback.setSpeed(speed)}
                  className="rounded-full px-2.5 py-1 text-xs aria-pressed:bg-accent aria-pressed:text-accent-ink"
                >
                  {speed}×
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function stopKind(stop: WalkStop): string {
  return stop.kind === "photo"
    ? "Photo"
    : stop.kind === "audio"
      ? "Audio"
      : "Note";
}

function StopPopup({ stop }: { stop: Stop }) {
  return (
    <figure className="max-w-md rounded-2xl border border-line bg-surface p-3 shadow-xl">
      {stop.kind === "note" ? (
        <p className="whitespace-pre-wrap px-6 py-4 text-lg">{stop.note}</p>
      ) : stop.kind === "photo" ? (
        isHeicMime(stop.mimeType) ? (
          <p className="px-6 py-4 text-lg">
            HEIC preview unavailable. Original photo retained.
          </p>
        ) : stop.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage URLs
          <img
            src={stop.url}
            alt={stop.alt ?? ""}
            className="max-h-72 w-full rounded-xl object-contain"
          />
        ) : (
          <p className="px-6 py-4 text-lg">Photo unavailable.</p>
        )
      ) : (
        <p className="px-6 py-4 text-lg">
          <span aria-hidden="true">🎙</span> Audio note playing…
        </p>
      )}
      {stop.kind !== "note" && stop.caption && (
        <figcaption className="mt-2 text-center text-sm text-ink-muted">
          {stop.caption}
        </figcaption>
      )}
    </figure>
  );
}

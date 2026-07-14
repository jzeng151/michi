"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Marker, type MapRef } from "react-map-gl/maplibre";
import { MapCanvas } from "@/components/map/MapCanvas";
import { RouteLayer } from "@/components/map/RouteLayer";
import { usePlaybackTimeline } from "./usePlaybackTimeline";
import { StepThrough } from "./StepThrough";
import { isHeicMime } from "@/lib/media-url";
import type { LineString, MediaPin, WalkPin } from "@/lib/types";

export type PlaybackMode = "cinematic" | "steps";

const controlButton =
  "rounded-full border border-line bg-surface px-4 py-2 text-sm transition-colors hover:bg-wash";

export function PlaybackOverlay({
  title,
  path,
  media,
  initialMode,
  onExit,
}: {
  title: string;
  path: LineString;
  media: WalkPin[];
  initialMode: PlaybackMode;
  onExit: () => void;
}) {
  // Reduced motion always gets the static step-through, whatever was asked.
  const [mode] = useState<PlaybackMode>(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "steps"
      : initialMode,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const mediaStops = useMemo(
    () => media.filter((pin): pin is MediaPin => pin.kind !== "note"),
    [media],
  );

  const playback = usePlaybackTimeline({
    path,
    media: mediaStops,
    getMap: () => mapRef.current,
    progressElRef: progressRef,
  });

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>("[data-autofocus]")
      ?.focus();
  }, []);

  // Document-level so Escape closes the overlay wherever focus sits.
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onExit]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const { status, activeStop } = playback;
  const [lng, lat] = path.coordinates[0];

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

      {mode === "steps" ? (
        <div className="min-h-0 flex-1">
          <StepThrough title={title} path={path} media={media} />
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
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
            <Marker longitude={lng} latitude={lat}>
              <span
                aria-hidden="true"
                className="block h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent shadow"
              />
            </Marker>
          </MapCanvas>

          {status === "ready" && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/40">
              <button
                type="button"
                onClick={() => playback.start()}
                className="rounded-full bg-accent px-8 py-4 text-lg font-medium text-accent-ink shadow-lg transition-transform hover:scale-105"
              >
                ▶ Begin walk
              </button>
            </div>
          )}

          {activeStop && (
            <div
              aria-live="polite"
              className="absolute inset-x-0 bottom-24 z-10 flex justify-center px-4"
            >
              <figure className="max-w-md rounded-2xl border border-line bg-surface p-3 shadow-xl">
                {activeStop.kind === "photo" ? (
                  isHeicMime(activeStop.mimeType) ? (
                    <p className="px-6 py-4 text-lg">
                      HEIC preview unavailable. Original photo retained.
                    </p>
                  ) : activeStop.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- storage URLs
                    <img
                      src={activeStop.url}
                      alt={activeStop.alt ?? ""}
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
                {activeStop.caption && (
                  <figcaption className="mt-2 text-center text-sm text-ink-muted">
                    {activeStop.caption}
                  </figcaption>
                )}
              </figure>
            </div>
          )}

          {status === "ended" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-canvas/40">
              <p className="font-display text-2xl">
                {title} <span aria-hidden="true">·</span> walked
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => playback.replay()}
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

          {status !== "ready" && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3">
              {status === "playing" || status === "media" ? (
                <button
                  type="button"
                  onClick={() => playback.pause()}
                  aria-label="Pause playback"
                  className={controlButton}
                >
                  ⏸
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => playback.resume()}
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
                onChange={(e) => playback.scrub(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

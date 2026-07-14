"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type MapRef } from "react-map-gl/maplibre";
import { MapCanvas } from "@/components/map/MapCanvas";
import { RouteLayer } from "@/components/map/RouteLayer";
import { MediaMarker } from "@/components/map/MediaMarker";
import { isHeicMime } from "@/lib/media-url";
import type { LineString, WalkPin, WalkStop } from "@/lib/types";

/**
 * Non-animated playback: fit the route once, page through the stops.
 * Serves prefers-reduced-motion and keyboard/screen-reader users, and is
 * offered to everyone as an alternative to the cinematic flight.
 */
export function StepThrough({
  title,
  path,
  media,
}: {
  title: string;
  path: LineString | null;
  media: WalkStop[];
}) {
  const mapRef = useRef<MapRef>(null);
  const [index, setIndex] = useState(0);
  const stop = media[index] ?? null;
  const pins = useMemo(
    () =>
      media.flatMap<WalkPin>((item, listIndex) =>
        item.lng === null || item.lat === null
          ? []
          : [{ ...item, lng: item.lng, lat: item.lat, listIndex }],
      ),
    [media],
  );
  const activePin = pins.find(({ listIndex }) => listIndex === index) ?? null;

  useEffect(() => {
    if (!stop || stop.lng === null || stop.lat === null) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    mapRef.current?.easeTo({
      center: [stop.lng, stop.lat],
      zoom: 15.5,
      duration: reduce ? 0 : 400,
    });
  }, [stop]);

  const coordinates =
    path?.coordinates ?? pins.map(({ lng, lat }) => [lng, lat] as [number, number]);
  const start = coordinates[0];

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <MapCanvas
          ref={mapRef}
          label={`Route map: ${title}`}
          initialViewState={
            start
              ? { longitude: start[0], latitude: start[1], zoom: 13 }
              : undefined
          }
          onLoad={() => {
            const coords = coordinates;
            if (coords.length === 0) return;
            if (coords.length === 1) {
              mapRef.current?.jumpTo({ center: coords[0], zoom: 15.5 });
              return;
            }
            let minLng = Infinity,
              minLat = Infinity,
              maxLng = -Infinity,
              maxLat = -Infinity;
            for (const [x, y] of coords) {
              minLng = Math.min(minLng, x);
              minLat = Math.min(minLat, y);
              maxLng = Math.max(maxLng, x);
              maxLat = Math.max(maxLat, y);
            }
            mapRef.current?.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              { padding: 64, duration: 0, maxZoom: 15.5 },
            );
          }}
        >
          {path && <RouteLayer path={path} />}
          {activePin && (
            <MediaMarker
              pin={activePin}
              index={index}
            />
          )}
        </MapCanvas>
      </div>
      <div
        className="flex shrink-0 flex-col gap-3 border-t border-line bg-surface p-4"
        aria-live="polite"
      >
        {media.length === 0 ? (
          <p className="text-sm text-ink-muted">
            This walk has no stops yet — enjoy the route.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              Stop {index + 1} of {media.length} ·{" "}
              {stop!.kind === "note"
                ? "Note"
                : stop!.kind === "photo"
                  ? "Photo"
                  : "Audio note"}
            </p>
            {stop!.kind === "note" ? (
              <p className="rounded-lg bg-wash p-3 text-sm">{stop!.note}</p>
            ) : stop!.kind === "photo" ? (
              isHeicMime(stop!.mimeType) ? (
                <p className="rounded-lg bg-wash p-3 text-sm">
                  HEIC preview unavailable. Original photo retained.
                </p>
              ) : stop!.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- storage URLs
                <img
                  src={stop!.url}
                  alt={stop!.alt ?? ""}
                  className="max-h-56 w-full rounded-xl object-contain"
                />
              ) : (
                <p className="rounded-lg bg-wash p-3 text-sm">
                  Photo unavailable.
                </p>
              )
            ) : stop!.url ? (
              <audio controls src={stop!.url} className="w-full" />
            ) : (
              <p className="rounded-lg bg-wash p-3 text-sm">
                Audio unavailable.
              </p>
            )}
            {stop!.kind !== "note" && stop!.caption && (
              <p className="text-sm">{stop!.caption}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="rounded-full border border-line px-4 py-2 text-sm transition-colors hover:bg-wash disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                type="button"
                disabled={index === media.length - 1}
                onClick={() =>
                  setIndex((i) => Math.min(media.length - 1, i + 1))
                }
                className="rounded-full border border-line px-4 py-2 text-sm transition-colors hover:bg-wash disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

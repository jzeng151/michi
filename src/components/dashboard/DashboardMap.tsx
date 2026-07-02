"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Marker, type MapRef } from "react-map-gl/maplibre";
import { MapCanvas } from "@/components/map/MapCanvas";
import { RouteLayer } from "@/components/map/RouteLayer";
import { MediaMarker } from "@/components/map/MediaMarker";
import {
  emitMapClick,
  getMapDisplay,
  setCenterPointProvider,
  useMapDisplay,
  type MapDisplay,
} from "@/components/map/display-store";

function boundsOf(coords: [number, number][]) {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ] as [[number, number], [number, number]];
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function fitTo(map: MapRef, display: MapDisplay) {
  // Draft mode manages its own camera (GPS follow); don't fight the user
  // while they draw.
  if (!display || display.kind === "draft") return;
  const coords =
    display.kind === "walk"
      ? display.path.coordinates
      : display.points.map((p) => p.start);
  if (coords.length === 0) return;
  map.fitBounds(boundsOf(coords), {
    padding: 72,
    maxZoom: 15.5,
    duration: reducedMotion() ? 0 : 900,
  });
}

/** Scroll the sidebar's matching stop entry into view when a pin is clicked. */
function focusStop(mediaId: string) {
  const el = document.getElementById(`stop-${mediaId}`);
  if (el) {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }
}

export function DashboardMap() {
  const mapRef = useRef<MapRef>(null);
  const display = useMapDisplay();
  const router = useRouter();

  // On fresh page loads the display is published before the map instance
  // exists, so fit both when the display changes and when the map loads.
  useEffect(() => {
    if (mapRef.current) fitTo(mapRef.current, display);
  }, [display]);

  // GPS follow: gently track the current fix while recording.
  const position = display?.kind === "draft" ? display.position : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    map.easeTo({
      center: position,
      zoom: Math.max(map.getZoom(), 15.5),
      duration: reducedMotion() ? 0 : 500,
    });
  }, [position]);

  useEffect(() => {
    setCenterPointProvider(() => {
      const center = mapRef.current?.getCenter();
      if (center) emitMapClick([center.lng, center.lat]);
    });
    return () => setCenterPointProvider(null);
  }, []);

  const isDraft = display?.kind === "draft";
  const draftLine =
    isDraft && display.coordinates.length >= 2
      ? { type: "LineString" as const, coordinates: display.coordinates }
      : null;

  return (
    <MapCanvas
      ref={mapRef}
      label="Map of walks"
      cursor={isDraft ? "crosshair" : "auto"}
      onClick={(e) => emitMapClick([e.lngLat.lng, e.lngLat.lat])}
      onLoad={() => {
        if (mapRef.current) fitTo(mapRef.current, getMapDisplay());
      }}
    >
      {display?.kind === "walk" && (
        <>
          <RouteLayer path={display.path} />
          <Marker
            longitude={display.path.coordinates[0][0]}
            latitude={display.path.coordinates[0][1]}
          >
            <span
              aria-hidden="true"
              className="block h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent shadow"
            />
          </Marker>
          {display.media.map((pin, i) => (
            <MediaMarker key={pin.id} pin={pin} index={i} onSelect={focusStop} />
          ))}
        </>
      )}

      {display?.kind === "overview" &&
        display.points.map((p) => (
          <Marker
            key={p.id}
            longitude={p.start[0]}
            latitude={p.start[1]}
            onClick={() => router.push(`/dashboard/walks/${p.id}`)}
            style={{ cursor: "pointer" }}
          >
            <span
              aria-hidden="true"
              className="block h-4 w-4 rounded-full border-2 border-surface bg-accent shadow-md transition-transform hover:scale-125"
            />
            <span className="sr-only">Open walk: {p.title}</span>
          </Marker>
        ))}

      {isDraft && (
        <>
          {draftLine && <RouteLayer path={draftLine} />}
          {display.coordinates.map(([lng, lat], i) => (
            <Marker key={`wp-${i}`} longitude={lng} latitude={lat}>
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-accent bg-surface text-[10px] font-medium"
              >
                {i + 1}
              </span>
            </Marker>
          ))}
          {display.media.map((pin, i) => (
            <MediaMarker key={pin.id} pin={pin} index={i} />
          ))}
          {position && (
            <Marker longitude={position[0]} latitude={position[1]}>
              <span
                aria-hidden="true"
                className="block h-4 w-4 animate-pulse rounded-full border-2 border-surface bg-accent shadow-lg"
              />
            </Marker>
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <span className="font-display text-2xl text-ink opacity-60">+</span>
          </div>
        </>
      )}
    </MapCanvas>
  );
}

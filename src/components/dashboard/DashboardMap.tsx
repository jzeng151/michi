"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Marker, type MapRef } from "react-map-gl/maplibre";
import { MapCanvas } from "@/components/map/MapCanvas";
import { RouteLayer } from "@/components/map/RouteLayer";
import { MediaMarker } from "@/components/map/MediaMarker";
import {
  getMapDisplay,
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

/** Scroll the sidebar's matching stop entry into view when a pin is clicked. */
function focusStop(mediaId: string) {
  const el = document.getElementById(`stop-${mediaId}`);
  if (el) {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }
}

function fitTo(map: MapRef, display: MapDisplay) {
  if (!display) return;
  const coords =
    display.kind === "walk"
      ? display.path.coordinates
      : display.points.map((p) => p.start);
  if (coords.length === 0) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  map.fitBounds(boundsOf(coords), {
    padding: 72,
    maxZoom: 15.5,
    duration: reduce ? 0 : 900,
  });
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

  return (
    <MapCanvas
      ref={mapRef}
      label="Map of walks"
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
          <Marker key={p.id} longitude={p.start[0]} latitude={p.start[1]}>
            <button
              type="button"
              aria-label={`Open walk: ${p.title}`}
              onClick={() => router.push(`/dashboard/walks/${p.id}`)}
              className="block h-4 w-4 cursor-pointer rounded-full border-2 border-surface bg-accent shadow-md transition-transform hover:scale-125"
            />
          </Marker>
        ))}
    </MapCanvas>
  );
}

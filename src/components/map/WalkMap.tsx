"use client";

import { useRef } from "react";
import { type MapRef } from "react-map-gl/maplibre";
import { MapCanvas } from "./MapCanvas";
import { RouteLayer } from "./RouteLayer";
import { MediaMarker } from "./MediaMarker";
import type { LineString, WalkPin } from "@/lib/types";

/** Self-contained walk map for pages outside the dashboard frame. */
export function WalkMap({
  title,
  path,
  media,
}: {
  title: string;
  path: LineString | null;
  media: WalkPin[];
}) {
  const mapRef = useRef<MapRef>(null);
  const coordinates =
    path?.coordinates ??
    media.map(({ lng, lat }) => [lng, lat] as [number, number]);
  const start = coordinates[0];

  return (
    <MapCanvas
      ref={mapRef}
      label={`Route map: ${title}`}
      initialViewState={
        start ? { longitude: start[0], latitude: start[1], zoom: 12 } : undefined
      }
      onLoad={() => {
        if (coordinates.length === 0) return;
        let minLng = Infinity,
          minLat = Infinity,
          maxLng = -Infinity,
          maxLat = -Infinity;
        for (const [x, y] of coordinates) {
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
          { padding: 48, duration: 0, maxZoom: 15.5 },
        );
      }}
    >
      {path && <RouteLayer path={path} />}
      {media.map((pin, i) => (
        <MediaMarker key={pin.id} pin={pin} index={i} />
      ))}
    </MapCanvas>
  );
}

"use client";

import { useRef } from "react";
import { type MapRef } from "react-map-gl/maplibre";
import { MapCanvas } from "./MapCanvas";
import { RouteLayer } from "./RouteLayer";
import { MediaMarker } from "./MediaMarker";
import type { LineString, MediaPin } from "@/lib/types";

/** Self-contained walk map for pages outside the dashboard frame. */
export function WalkMap({
  title,
  path,
  media,
}: {
  title: string;
  path: LineString;
  media: MediaPin[];
}) {
  const mapRef = useRef<MapRef>(null);
  const [lng, lat] = path.coordinates[0];

  return (
    <MapCanvas
      ref={mapRef}
      label={`Route map: ${title}`}
      initialViewState={{ longitude: lng, latitude: lat, zoom: 12 }}
      onLoad={() => {
        const coords = path.coordinates;
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
          { padding: 48, duration: 0, maxZoom: 15.5 },
        );
      }}
    >
      <RouteLayer path={path} />
      {media.map((pin, i) => (
        <MediaMarker key={pin.id} pin={pin} index={i} />
      ))}
    </MapCanvas>
  );
}

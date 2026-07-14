"use client";

import { Marker } from "react-map-gl/maplibre";
import type { CuratedReplayEntry, ReplayEntry } from "@/lib/layered-memory";

export function CuratedWaypointMarkers({
  entries,
  activeWaypointId,
}: {
  entries: ReplayEntry[];
  activeWaypointId?: string;
}) {
  const waypoints = new Map<string, CuratedReplayEntry>();
  for (const entry of entries) {
    if (entry.kind === "story" && !waypoints.has(entry.waypointId)) {
      waypoints.set(entry.waypointId, entry);
    }
  }

  return [...waypoints.values()].map((entry) => (
    <Marker
      key={entry.waypointId}
      longitude={entry.lng}
      latitude={entry.lat}
      anchor="bottom"
    >
      <span
        aria-hidden="true"
        data-curated-waypoint={entry.waypointId}
        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold shadow-md ${
          activeWaypointId === entry.waypointId
            ? "border-accent bg-accent text-accent-ink"
            : "border-accent bg-surface text-accent-text"
        }`}
      >
        道
      </span>
      <span className="sr-only">The path&apos;s story: {entry.title}</span>
    </Marker>
  ));
}

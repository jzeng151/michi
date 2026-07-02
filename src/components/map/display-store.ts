import { useSyncExternalStore } from "react";
import type { LineString, MediaPin } from "@/lib/types";

export type OverviewPoint = {
  id: string;
  title: string;
  start: [number, number];
};

export type MapDisplay =
  | { kind: "walk"; walkId: string; path: LineString; media: MediaPin[] }
  | { kind: "overview"; points: OverviewPoint[] }
  | null;

// Module-level store so sidebar pages can publish to the map (which lives in
// the persistent dashboard frame) without prop-drilling across route
// boundaries. Same pattern as the theme store.
let display: MapDisplay = null;
const listeners = new Set<() => void>();

export function setMapDisplay(next: MapDisplay) {
  display = next;
  listeners.forEach((l) => l());
}

export function getMapDisplay(): MapDisplay {
  return display;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMapDisplay(): MapDisplay {
  return useSyncExternalStore(subscribe, () => display, () => null);
}

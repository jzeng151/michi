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
  | {
      kind: "draft";
      coordinates: [number, number][];
      media: MediaPin[];
      /** GPS mode: current fix to follow. */
      position: [number, number] | null;
    }
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

// ---- draw-mode plumbing -----------------------------------------------
// The creation panel registers a click handler; the map emits clicks and
// provides "add point at map center" for keyboard users.

let mapClickHandler: ((lngLat: [number, number]) => void) | null = null;
let centerPointProvider: (() => void) | null = null;

export function setMapClickHandler(
  handler: ((lngLat: [number, number]) => void) | null,
) {
  mapClickHandler = handler;
}

export function emitMapClick(lngLat: [number, number]) {
  mapClickHandler?.(lngLat);
}

export function hasMapClickHandler(): boolean {
  return mapClickHandler !== null;
}

/** Registered by the map: emits a click at the current map center. */
export function setCenterPointProvider(provider: (() => void) | null) {
  centerPointProvider = provider;
}

export function requestCenterPoint() {
  centerPointProvider?.();
}

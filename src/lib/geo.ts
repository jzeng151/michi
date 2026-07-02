import type { LineString } from "./types";

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in meters between two [lng, lat] points. */
export function haversine(a: [number, number], b: [number, number]): number {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Total path length in meters. */
export function pathDistance(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversine(coords[i - 1], coords[i]);
  }
  return Math.round(total);
}

/** Cumulative distance at each vertex; same length as coords, starts at 0. */
export function cumulativeDistances(coords: [number, number][]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  }
  return out;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Point at fraction t ∈ [0,1] of the path's length, interpolated linearly
 * between vertices (fine at walking-route scale).
 */
export function pointAtFraction(
  path: LineString,
  cumulative: number[],
  t: number,
): [number, number] {
  const coords = path.coordinates;
  const total = cumulative[cumulative.length - 1];
  if (total === 0 || t <= 0) return coords[0];
  if (t >= 1) return coords[coords.length - 1];
  const target = t * total;
  let i = 1;
  while (i < cumulative.length && cumulative[i] < target) i++;
  const segT =
    (target - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1);
  return [
    lerp(coords[i - 1][0], coords[i][0], segT),
    lerp(coords[i - 1][1], coords[i][1], segT),
  ];
}

/** Bearing in degrees (0 = north) of the segment containing fraction t. */
export function bearingAtFraction(
  path: LineString,
  cumulative: number[],
  t: number,
): number {
  const coords = path.coordinates;
  const total = cumulative[cumulative.length - 1];
  const target = Math.min(Math.max(t, 0), 1) * total;
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < target) i++;
  const [lng1, lat1] = coords[i - 1];
  const [lng2, lat2] = coords[i];
  const toRad = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * toRad) * Math.cos(lat2 * toRad);
  const x =
    Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) *
      Math.cos(lat2 * toRad) *
      Math.cos((lng2 - lng1) * toRad);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Signed shortest rotation (degrees, -180..180) from one bearing to another. */
export function shortestArcDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** Fraction along the path of the vertex nearest to the given point. */
export function nearestFraction(
  path: LineString,
  cumulative: number[],
  point: [number, number],
): number {
  const coords = path.coordinates;
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return 0;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversine(coords[i], point);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return cumulative[best] / total;
}

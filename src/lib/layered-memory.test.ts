import { expect, it } from "vitest";
import { mergeReplayEntries, type CuratedWaypointMatch } from "./layered-memory";
import type { WalkStop } from "./types";

it("merges stories deterministically without mutating either source list", () => {
  const stops: WalkStop[] = [
    {
      id: "stop-1",
      kind: "note",
      note: "First memory",
      capturedAt: null,
      lat: 35,
      lng: 135,
    },
    {
      id: "stop-2",
      kind: "note",
      note: "Second memory",
      capturedAt: null,
      lat: 35.001,
      lng: 135.001,
    },
  ];
  const match = (
    matchedStopId: string,
    waypointId: string,
    distanceM: number,
    sortIndex: number,
  ): CuratedWaypointMatch => ({
    matchedStopId,
    waypointId,
    routeId: "route-1",
    routeTitle: "Nakasendo",
    timePeriod: "Edo period",
    title: waypointId,
    titleJa: null,
    story: `${waypointId} story`,
    lat: 35,
    lng: 135,
    sortIndex,
    distanceM,
    url: null,
    alt: null,
    mimeType: null,
    mediaCredit: null,
    mediaLicense: null,
    mediaSourceUrl: null,
  });
  const matches = [
    match("stop-1", "farther", 40, 0),
    match("missing-stop", "ignored", 0, 0),
    match("stop-2", "shared", 10, 2),
    match("stop-1", "shared", 10, 2),
    match("stop-1", "earlier-route-order", 10, 1),
  ];
  const originalStops = structuredClone(stops);
  const originalMatches = structuredClone(matches);

  expect(mergeReplayEntries(stops, matches).map(({ id }) => id)).toEqual([
    "stop-1",
    "story:stop-1:earlier-route-order",
    "story:stop-1:shared",
    "story:stop-1:farther",
    "stop-2",
    "story:stop-2:shared",
  ]);
  expect(stops).toEqual(originalStops);
  expect(matches).toEqual(originalMatches);
});

import type { WalkStop } from "./types";

export type CuratedWaypointMatch = {
  matchedStopId: string;
  waypointId: string;
  routeId: string;
  routeTitle: string;
  timePeriod: string;
  title: string;
  story: string;
  lat: number;
  lng: number;
  sortIndex: number;
  distanceM: number;
  url: string | null;
  alt: string | null;
  mimeType: string | null;
};

export type PersonalReplayEntry = WalkStop & { source: "personal" };

export type CuratedReplayEntry = {
  id: string;
  waypointId: string;
  matchedStopId: string;
  kind: "story";
  source: "curated";
  routeTitle: string;
  timePeriod: string;
  title: string;
  story: string;
  lat: number;
  lng: number;
  url: string | null;
  alt: string | null;
  mimeType: string | null;
};

export type ReplayEntry = PersonalReplayEntry | CuratedReplayEntry;

export function replayEntryKind(entry: ReplayEntry): string {
  return entry.kind === "photo"
    ? "Photo"
    : entry.kind === "audio"
      ? "Audio"
      : entry.kind === "note"
        ? "Note"
        : "Story";
}

export function replayEntryLabel(entry: ReplayEntry, layered: boolean): string {
  if (!layered) return replayEntryKind(entry);
  return entry.kind === "story"
    ? `The path's story · ${entry.title}`
    : `Your stop · ${replayEntryKind(entry)}`;
}

function compareMatches(
  a: CuratedWaypointMatch,
  b: CuratedWaypointMatch,
): number {
  return (
    a.distanceM - b.distanceM ||
    a.routeTitle.localeCompare(b.routeTitle) ||
    a.sortIndex - b.sortIndex ||
    a.waypointId.localeCompare(b.waypointId)
  );
}

export function mergeReplayEntries(
  personalStops: readonly WalkStop[],
  matches: readonly CuratedWaypointMatch[],
): ReplayEntry[] {
  const personalIds = new Set(personalStops.map(({ id }) => id));
  const matchesByStop = new Map<string, CuratedWaypointMatch[]>();

  for (const match of matches) {
    if (!personalIds.has(match.matchedStopId)) continue;
    const entries = matchesByStop.get(match.matchedStopId) ?? [];
    entries.push(match);
    matchesByStop.set(match.matchedStopId, entries);
  }

  for (const entries of matchesByStop.values()) entries.sort(compareMatches);

  return personalStops.flatMap<ReplayEntry>((stop) => [
    { ...stop, source: "personal" },
    ...(matchesByStop.get(stop.id) ?? []).map((match) => ({
      id: `story:${match.matchedStopId}:${match.waypointId}`,
      waypointId: match.waypointId,
      matchedStopId: match.matchedStopId,
      kind: "story" as const,
      source: "curated" as const,
      routeTitle: match.routeTitle,
      timePeriod: match.timePeriod,
      title: match.title,
      story: match.story,
      lat: match.lat,
      lng: match.lng,
      url: match.url,
      alt: match.alt,
      mimeType: match.mimeType,
    })),
  ]);
}

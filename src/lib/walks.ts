import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { lineStringFromCoordinates, pathDistance } from "./geo";
import { isHeicMime, resolveMediaUrls } from "./media-url";
import type {
  LineString,
  MediaRow,
  MediaStop,
  WalkPin,
  WalkStop,
  WalkRow,
  WalkStopRow,
  WalkSummary,
} from "./types";

type Client = SupabaseClient<Database>;

// Single literal (not concatenated) so supabase-js can parse it at the type level.
const SUMMARY_SELECT =
  "id, owner_id, title, description, region, path, distance_m, duration_s, visibility, is_curated, created_at, walk_stops(id, kind, sort_index, lat, lng, note, walk_media(id, bucket, storage_path, alt_text, mime_type))";

type StopWithMedia = WalkStopRow & { walk_media: MediaRow | null };
type SummaryRow = WalkRow & {
  walk_stops: StopWithMedia[];
};

function ordered(stops: StopWithMedia[]): StopWithMedia[] {
  return [...stops].sort(
    (a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id),
  );
}

function placedCoordinates(stops: StopWithMedia[]): [number, number][] {
  return stops.flatMap((stop) =>
    stop.lng === null || stop.lat === null
      ? []
      : [[stop.lng, stop.lat] as [number, number]],
  );
}

function routeOf(
  path: LineString | null,
  stops: StopWithMedia[],
): LineString | null {
  return path ?? lineStringFromCoordinates(placedCoordinates(stops));
}

function distanceOf(
  storedPath: LineString | null,
  route: LineString | null,
  storedDistance: number,
): number {
  return storedPath === null && route
    ? pathDistance(route.coordinates)
    : storedDistance;
}

function coverOf(stops: StopWithMedia[]): MediaRow | null {
  return stops.find(
    (stop) =>
      stop.kind === "photo" &&
      stop.walk_media &&
      !isHeicMime(stop.walk_media.mime_type),
  )
    ?.walk_media ?? null;
}

async function toSummaries(
  supabase: Client,
  rows: SummaryRow[],
): Promise<WalkSummary[]> {
  const stops = rows.map((row) => ordered(row.walk_stops));
  const covers = stops.map(coverOf);
  const urls = await resolveMediaUrls(
    supabase,
    covers.filter((c): c is MediaRow => c !== null),
  );
  return rows.map((row, i) => {
    const cover = covers[i];
    const url = cover ? urls.get(cover.storage_path) : undefined;
    const placed = placedCoordinates(stops[i]);
    const route = routeOf(row.path, stops[i]);
    return {
      id: row.id,
      title: row.title,
      region: row.region,
      distanceM: distanceOf(row.path, route, row.distance_m),
      isCurated: row.is_curated,
      cover: cover && url ? { url, alt: cover.alt_text ?? "" } : null,
      start: route?.coordinates[0] ?? placed[0] ?? null,
    };
  });
}

export type BrowseLists = {
  curated: WalkSummary[];
  mine: WalkSummary[];
};

export async function fetchBrowseLists(
  supabase: Client,
  userId: string,
): Promise<BrowseLists> {
  const [curatedRes, mineRes] = await Promise.all([
    supabase
      .from("walks")
      .select(SUMMARY_SELECT)
      .eq("is_curated", true)
      .order("created_at"),
    supabase
      .from("walks")
      .select(SUMMARY_SELECT)
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const curated = await toSummaries(
    supabase,
    (curatedRes.data ?? []) as unknown as SummaryRow[],
  );
  const mine = await toSummaries(
    supabase,
    (mineRes.data ?? []) as unknown as SummaryRow[],
  );

  return { curated, mine };
}

export type WalkDetailData = {
  walk: WalkRow;
  ownerName: string;
  ownerUsername: string;
  media: WalkStop[];
  pins: WalkPin[];
};

type DetailRow = WalkRow & {
  profiles: { username: string; display_name: string | null } | null;
  walk_stops: StopWithMedia[];
};

export async function fetchWalkDetail(
  supabase: Client,
  id: string,
): Promise<WalkDetailData | null> {
  const { data } = await supabase
    .from("walks")
    .select(
      "*, profiles!walks_owner_id_fkey(username, display_name), walk_stops(id, kind, sort_index, lat, lng, note, walk_media(id, bucket, storage_path, alt_text, mime_type))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as DetailRow;
  const stops = ordered(row.walk_stops);
  const mediaRows = stops.flatMap((stop) =>
    stop.walk_media ? [stop.walk_media] : [],
  );
  const urls = await resolveMediaUrls(supabase, mediaRows);
  const media = stops.flatMap<WalkStop>((stop) => {
    if (stop.kind === "note") {
      return stop.note
        ? [
            {
              id: stop.id,
              kind: "note",
              note: stop.note,
              lat: stop.lat,
              lng: stop.lng,
            },
          ]
        : [];
    }
    if (!stop.walk_media) return [];
    const row = stop.walk_media;
    const item: MediaStop = {
      id: row.id,
      kind: stop.kind,
      url: isHeicMime(row.mime_type)
        ? null
        : (urls.get(row.storage_path) ?? null),
      mimeType: row.mime_type,
      alt: row.alt_text,
      caption: stop.note,
      lat: stop.lat,
      lng: stop.lng,
    };
    return [item];
  });
  const pins: WalkPin[] = media.flatMap((item, listIndex) =>
    item.lat === null || item.lng === null
      ? []
      : [{ ...item, lat: item.lat, lng: item.lng, listIndex }],
  );

  const profile = row.profiles;

  const route = routeOf(row.path, stops);
  const walk: WalkRow = {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    region: row.region,
    path: route,
    distance_m: distanceOf(row.path, route, row.distance_m),
    duration_s: row.duration_s,
    visibility: row.visibility,
    is_curated: row.is_curated,
    created_at: row.created_at,
  };

  return {
    walk,
    ownerName: profile?.display_name ?? profile?.username ?? "Unknown walker",
    ownerUsername: profile?.username ?? "walker",
    media,
    pins,
  };
}

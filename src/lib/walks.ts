import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { resolveMediaUrls } from "./media-url";
import type {
  LineString,
  MediaPin,
  MediaRow,
  WalkRow,
  WalkSummary,
} from "./types";

type Client = SupabaseClient<Database>;

// Single literal (not concatenated) so supabase-js can parse it at the type level.
const SUMMARY_SELECT =
  "id, owner_id, title, description, region, path, distance_m, duration_s, visibility, is_curated, created_at, walk_media(id, kind, bucket, storage_path, alt_text, caption, lat, lng, sort_index)";

type SummaryRow = WalkRow & {
  walk_media: MediaRow[];
};

function coverOf(row: SummaryRow): MediaRow | null {
  return (
    row.walk_media
      .filter((m) => m.kind === "photo")
      .sort((a, b) => a.sort_index - b.sort_index)[0] ?? null
  );
}

async function toSummaries(
  supabase: Client,
  rows: SummaryRow[],
): Promise<WalkSummary[]> {
  const covers = rows.map(coverOf);
  const urls = await resolveMediaUrls(
    supabase,
    covers.filter((c): c is MediaRow => c !== null),
  );
  return rows.map((row, i) => {
    const cover = covers[i];
    const url = cover ? urls.get(cover.storage_path) : undefined;
    return {
      id: row.id,
      title: row.title,
      region: row.region,
      distanceM: row.distance_m,
      isCurated: row.is_curated,
      cover: cover && url ? { url, alt: cover.alt_text ?? "" } : null,
      start: row.path.coordinates[0],
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
    (curatedRes.data ?? []) as SummaryRow[],
  );
  const mine = await toSummaries(supabase, (mineRes.data ?? []) as SummaryRow[]);

  return { curated, mine };
}

export type WalkDetailData = {
  walk: WalkRow;
  ownerName: string;
  ownerUsername: string;
  media: MediaPin[];
};

export async function fetchWalkDetail(
  supabase: Client,
  id: string,
): Promise<WalkDetailData | null> {
  const { data } = await supabase
    .from("walks")
    .select(
      "*, profiles!walks_owner_id_fkey(username, display_name), walk_media(id, kind, bucket, storage_path, alt_text, caption, lat, lng, sort_index)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const mediaRows = (data.walk_media as MediaRow[])
    .filter((item) => item.kind === "photo")
    .sort((a, b) => a.sort_index - b.sort_index);
  const urls = await resolveMediaUrls(supabase, mediaRows);
  const media: MediaPin[] = mediaRows.map((m) => ({
    id: m.id,
    kind: m.kind,
    url: urls.get(m.storage_path) ?? null,
    alt: m.alt_text,
    caption: m.caption,
    lat: m.lat,
    lng: m.lng,
  }));

  const profile = data.profiles as {
    username: string;
    display_name: string | null;
  } | null;

  const walk: WalkRow = {
    id: data.id,
    owner_id: data.owner_id,
    title: data.title,
    description: data.description,
    region: data.region,
    path: data.path as unknown as LineString,
    distance_m: data.distance_m,
    duration_s: data.duration_s,
    visibility: data.visibility as "public" | "private",
    is_curated: data.is_curated,
    created_at: data.created_at ?? new Date().toISOString(),
  };

  return {
    walk,
    ownerName: profile?.display_name ?? profile?.username ?? "Unknown walker",
    ownerUsername: profile?.username ?? "walker",
    media,
  };
}

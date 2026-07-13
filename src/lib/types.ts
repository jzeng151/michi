export type LineString = {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat]
};

export type WalkRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  region: string | null;
  path: LineString | null;
  distance_m: number;
  duration_s: number | null;
  visibility: "public" | "private";
  is_curated: boolean;
  created_at: string;
};

export type MediaRow = {
  id: string;
  bucket: "walk-media" | "curated";
  storage_path: string;
  alt_text: string | null;
};

export type WalkStopRow = {
  id: string;
  kind: "photo" | "audio" | "note";
  sort_index: number;
  lat: number | null;
  lng: number | null;
  note: string | null;
};

/** Media-backed stop resolved for display; url is null when it cannot load. */
export type MediaStop = {
  id: string;
  kind: "photo" | "audio";
  url: string | null;
  alt: string | null;
  caption: string | null;
  lat: number | null;
  lng: number | null;
};

/** Located media stop, safe to render as a map pin. */
export type MediaPin = MediaStop & {
  lat: number;
  lng: number;
  /** Position in the complete media list, including unplaced stops. */
  listIndex?: number;
};

export type CommentItem = {
  id: string;
  body: string;
  created_at: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
};

export type WalkSummary = {
  id: string;
  title: string;
  region: string | null;
  distanceM: number;
  isCurated: boolean;
  cover: { url: string; alt: string } | null;
  start: [number, number] | null;
};

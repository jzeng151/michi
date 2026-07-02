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
  path: LineString;
  distance_m: number;
  duration_s: number | null;
  visibility: "public" | "private";
  is_curated: boolean;
  created_at: string;
};

export type MediaRow = {
  id: string;
  kind: "photo" | "audio";
  bucket: "walk-media" | "curated";
  storage_path: string;
  alt_text: string | null;
  caption: string | null;
  lat: number;
  lng: number;
  sort_index: number;
};

/** Media row resolved for display; url is null when the viewer may not load it. */
export type MediaPin = {
  id: string;
  kind: "photo" | "audio";
  url: string | null;
  alt: string | null;
  caption: string | null;
  lat: number;
  lng: number;
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
  likeCount: number;
  cover: { url: string; alt: string } | null;
  start: [number, number];
};

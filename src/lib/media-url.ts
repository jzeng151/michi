import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

const PUBLIC_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;

export function curatedUrl(path: string): string {
  return `${PUBLIC_BASE}/curated/${encodeURIComponent(path)}`;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
};

export function extForMime(mime: string): string | null {
  return MIME_EXT[mime.split(";")[0]] ?? null;
}

/**
 * Resolve display URLs for media rows, keyed by storage_path. Curated art is
 * on a public bucket; private-bucket paths get 1h signed URLs, which storage
 * RLS only mints for the owner or viewers of a public walk — unauthorized
 * paths are simply absent from the result.
 */
export async function resolveMediaUrls(
  supabase: SupabaseClient<Database>,
  media: { bucket: string; storage_path: string }[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const privatePaths: string[] = [];

  for (const m of media) {
    if (m.bucket === "curated") urls.set(m.storage_path, curatedUrl(m.storage_path));
    else privatePaths.push(m.storage_path);
  }

  if (privatePaths.length > 0) {
    const { data } = await supabase.storage
      .from("walk-media")
      .createSignedUrls(privatePaths, 3600);
    data?.forEach((entry, i) => {
      if (entry.signedUrl && !entry.error) {
        urls.set(privatePaths[i], entry.signedUrl);
      }
    });
  }

  return urls;
}

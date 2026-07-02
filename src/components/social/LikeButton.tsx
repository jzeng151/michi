"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LikeButton({
  walkId,
  initialCount,
  initialLiked,
  viewerId,
  isPublic,
}: {
  walkId: string;
  initialCount: number;
  initialLiked: boolean;
  viewerId: string;
  isPublic: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  if (!isPublic) {
    return (
      <span className="text-sm text-ink-muted">
        <span aria-hidden="true">♥</span>
        <span className="sr-only">Likes:</span> {count}
      </span>
    );
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    // Optimistic flip; revert on error.
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    const { error } = next
      ? await supabase.from("likes").insert({ walk_id: walkId, user_id: viewerId })
      : await supabase
          .from("likes")
          .delete()
          .eq("walk_id", walkId)
          .eq("user_id", viewerId);
    if (error) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? "Unlike this walk" : "Like this walk"}
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
        liked
          ? "border-accent bg-accent text-accent-ink"
          : "border-line hover:bg-wash"
      }`}
    >
      <span aria-hidden="true">♥</span> {count}
    </button>
  );
}

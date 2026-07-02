"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function FollowButton({
  ownerId,
  ownerName,
  viewerId,
  initialFollowing,
}: {
  ownerId: string;
  ownerName: string;
  viewerId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (ownerId === viewerId) return null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const next = !following;
    setFollowing(next);
    const { error } = next
      ? await supabase
          .from("follows")
          .insert({ follower_id: viewerId, followee_id: ownerId })
      : await supabase
          .from("follows")
          .delete()
          .eq("follower_id", viewerId)
          .eq("followee_id", ownerId);
    if (error) setFollowing(!next);
    setBusy(false);
  }

  return (
    <button
      type="button"
      aria-pressed={following}
      onClick={toggle}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        following
          ? "border-accent bg-accent text-accent-ink"
          : "border-line hover:bg-wash"
      }`}
    >
      {following ? `Following ${ownerName}` : `Follow ${ownerName}`}
    </button>
  );
}

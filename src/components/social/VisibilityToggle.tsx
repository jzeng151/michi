"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function VisibilityToggle({
  walkId,
  visibility,
}: {
  walkId: string;
  visibility: "public" | "private";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const next = visibility === "public" ? "private" : "public";
    const { error: updateError } = await createClient()
      .from("walks")
      .update({ visibility: next })
      .eq("id", walkId);
    if (updateError) {
      setError(updateError.message);
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        className="rounded-full border border-line px-3 py-1 text-sm transition-colors hover:bg-wash disabled:opacity-50"
      >
        {visibility === "public" ? "Make private" : "Share publicly"}
      </button>
      {error && <span className="text-sm text-accent">{error}</span>}
    </span>
  );
}

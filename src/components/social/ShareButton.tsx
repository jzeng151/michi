"use client";

import { useState } from "react";

export function ShareButton({ walkId, title }: { walkId: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/walks/${walkId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} · Michi`, url });
        return;
      } catch {
        // user dismissed the sheet; fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-full border border-line px-3 py-1 text-sm transition-colors hover:bg-wash"
    >
      {copied ? "Link copied ✓" : "Share"}
    </button>
  );
}

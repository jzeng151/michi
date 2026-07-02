"use client";

import { useEffect } from "react";
import Link from "next/link";
import { setMapDisplay } from "@/components/map/display-store";
import { formatDate, formatDistance } from "@/lib/format";
import type { WalkDetailData } from "@/lib/walks";
import { MediaStopList } from "./MediaStopList";

export function WalkDetailPanel({ data }: { data: WalkDetailData }) {
  const { walk, ownerName, likeCount, media } = data;

  useEffect(() => {
    setMapDisplay({ kind: "walk", walkId: walk.id, path: walk.path, media });
  }, [walk.id, walk.path, media]);

  return (
    <article className="flex flex-col gap-4 p-4">
      <Link
        href="/dashboard"
        className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
      >
        ← All walks
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">{walk.title}</h1>
        <p className="text-sm text-ink-muted">
          {[walk.region, formatDistance(walk.distance_m)]
            .filter(Boolean)
            .join(" · ")}{" "}
          · by {ownerName}
        </p>
        <p className="text-sm text-ink-muted">
          <span aria-hidden="true">♥</span>
          <span className="sr-only">Likes:</span> {likeCount} ·{" "}
          {formatDate(walk.created_at)}
          {walk.visibility === "private" && (
            <span className="ml-2 rounded-full bg-wash px-2 py-0.5 text-xs">
              Private
            </span>
          )}
        </p>
      </header>
      {walk.description && (
        <p className="text-sm leading-relaxed">{walk.description}</p>
      )}
      <MediaStopList media={media} />
    </article>
  );
}

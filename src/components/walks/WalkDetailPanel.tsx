"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { setMapDisplay } from "@/components/map/display-store";
import {
  PlaybackOverlay,
  type PlaybackMode,
} from "@/components/playback/PlaybackOverlay";
import { ShareButton } from "@/components/social/ShareButton";
import { VisibilityToggle } from "@/components/social/VisibilityToggle";
import { formatDate, formatDistance } from "@/lib/format";
import type { WalkDetailData } from "@/lib/walks";
import { MediaStopList } from "./MediaStopList";

export function WalkDetailPanel({
  data,
  viewerId,
}: {
  data: WalkDetailData;
  viewerId: string;
}) {
  const { walk, ownerName, ownerUsername, media, pins } = data;
  const isOwner = walk.owner_id === viewerId;
  const isPublic = walk.visibility === "public";
  const [playback, setPlayback] = useState<PlaybackMode | null>(null);

  useEffect(() => {
    setMapDisplay({ kind: "walk", walkId: walk.id, path: walk.path, media: pins });
  }, [walk.id, walk.path, pins]);

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
          · by {ownerName}{" "}
          {!walk.is_curated && (
            <span className="text-ink-muted">@{ownerUsername}</span>
          )}
        </p>
        <p className="text-sm text-ink-muted">
          {formatDate(walk.created_at)}
          {walk.visibility === "private" && (
            <span className="ml-2 rounded-full bg-wash px-2 py-0.5 text-xs">
              Private
            </span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isPublic && <ShareButton walkId={walk.id} title={walk.title} />}
          {isOwner && !walk.is_curated && (
            <VisibilityToggle walkId={walk.id} visibility={walk.visibility} />
          )}
        </div>
      </header>
      {walk.description && (
        <p className="text-sm leading-relaxed">{walk.description}</p>
      )}

      {walk.path && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPlayback("cinematic")}
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            ▶ Play this walk
          </button>
          <button
            type="button"
            onClick={() => setPlayback("steps")}
            className="rounded-full border border-line px-4 py-2 text-sm transition-colors hover:bg-wash"
          >
            Step through stops
          </button>
        </div>
      )}

      <MediaStopList media={media} />

      {playback && walk.path && (
        <PlaybackOverlay
          title={walk.title}
          path={walk.path}
          media={pins}
          initialMode={playback}
          onExit={() => setPlayback(null)}
        />
      )}
    </article>
  );
}

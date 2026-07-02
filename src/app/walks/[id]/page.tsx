import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fetchWalkDetail } from "@/lib/walks";
import { formatDate, formatDistance } from "@/lib/format";
import { WalkMap } from "@/components/map/WalkMap";
import { MediaStopList } from "@/components/walks/MediaStopList";

const getDetail = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  return fetchWalkDetail(supabase, id);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getDetail(id);
  if (!data) return { title: "Walk not found" };
  return {
    title: data.walk.title,
    description:
      data.walk.description ??
      `A ${formatDistance(data.walk.distance_m)} walk shared on Michi.`,
  };
}

export default async function PublicWalkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getDetail(id);
  // RLS hides private walks from non-owners, so this 404s for strangers.
  if (!data) notFound();

  const { walk, ownerName, likeCount, media } = data;
  const lockedMedia = media.some((m) => m.url === null);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
        <Link href="/" className="font-display text-lg font-semibold">
          <span className="text-accent" aria-hidden="true">
            道
          </span>{" "}
          Michi
        </Link>
        <Link
          href={`/login?next=/dashboard/walks/${walk.id}`}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
        >
          Open in Michi
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold">{walk.title}</h1>
          <p className="text-ink-muted">
            {[walk.region, formatDistance(walk.distance_m)]
              .filter(Boolean)
              .join(" · ")}{" "}
            · by {ownerName} · {formatDate(walk.created_at)}
          </p>
          <p className="text-sm text-ink-muted">
            <span aria-hidden="true">♥</span>
            <span className="sr-only">Likes:</span> {likeCount}
          </p>
        </header>

        {walk.description && (
          <p className="leading-relaxed">{walk.description}</p>
        )}

        <div className="h-[50dvh] overflow-hidden rounded-2xl border border-line">
          <WalkMap title={walk.title} path={walk.path} media={media} />
        </div>

        {lockedMedia && (
          <p className="rounded-xl bg-wash px-4 py-3 text-sm">
            Some photos and audio notes on this walk are only visible to
            signed-in walkers.{" "}
            <Link
              href={`/login?next=/walks/${walk.id}`}
              className="underline underline-offset-4"
            >
              Sign in to see everything.
            </Link>
          </p>
        )}

        <MediaStopList media={media} />
      </main>
    </div>
  );
}

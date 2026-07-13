import Link from "next/link";
import { formatDistance } from "@/lib/format";
import type { WalkSummary } from "@/lib/types";

export function WalkCard({ walk }: { walk: WalkSummary }) {
  return (
    <li>
      <Link
        href={`/dashboard/walks/${walk.id}`}
        className="flex gap-3 rounded-xl border border-line bg-canvas p-3 transition-colors hover:bg-wash"
      >
        {walk.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage URLs (signed/public); no next/image benefit locally
          <img
            src={walk.cover.url}
            alt={walk.cover.alt}
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-wash font-display text-xl text-accent-text"
          >
            道
          </span>
        )}
        <div className="flex min-w-0 flex-col justify-center gap-0.5">
          <p className="truncate font-medium">{walk.title}</p>
          <p className="truncate text-sm text-ink-muted">
            {[walk.region, formatDistance(walk.distanceM)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-sm text-ink-muted">
            <span aria-hidden="true">♥</span>
            <span className="sr-only">Likes:</span> {walk.likeCount}
            {walk.isCurated && (
              <span className="ml-2 rounded-full bg-wash px-2 py-0.5 text-xs">
                Curated
              </span>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}

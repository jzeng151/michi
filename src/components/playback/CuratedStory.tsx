import type { CuratedReplayEntry } from "@/lib/layered-memory";

export function CuratedStory({ entry }: { entry: CuratedReplayEntry }) {
  return (
    <div data-curated-story={entry.waypointId}>
      <p className="text-sm font-semibold text-ink">
        The path&apos;s story
      </p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-balance font-display text-xl font-semibold">
            {entry.title}
          </h2>
          {entry.titleJa && (
            <p lang="ja" className="font-display text-sm text-ink sm:hidden">
              {entry.titleJa}
            </p>
          )}
          <p className="text-xs text-ink-muted">
            {entry.timePeriod} · {entry.routeTitle}
          </p>
        </div>
        {entry.titleJa && (
          <p
            lang="ja"
            data-vertical-title
            className="hidden max-h-28 shrink-0 font-display text-base leading-none text-ink [text-orientation:upright] [writing-mode:vertical-rl] sm:block"
          >
            {entry.titleJa}
          </p>
        )}
      </div>
      {entry.url && (
        // eslint-disable-next-line @next/next/no-img-element -- public curated storage URL
        <img
          src={entry.url}
          alt={entry.alt ?? ""}
          className="mt-3 max-h-48 w-full rounded-xl object-cover"
        />
      )}
      <p className="mt-2 text-sm leading-relaxed">{entry.story}</p>
      {entry.mediaCredit && (
        <p className="mt-2 text-xs text-ink-muted">
          Photo: {entry.mediaCredit}
          {entry.mediaLicense && ` · ${entry.mediaLicense}`}
          {entry.mediaSourceUrl && (
            <>
              {" · "}
              <a
                href={entry.mediaSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-ink"
              >
                source
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}

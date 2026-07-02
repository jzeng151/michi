import type { MediaPin } from "@/lib/types";

/**
 * Text/list parity for the map's media pins: every pin is reachable and
 * understandable without the map. Items are focus targets for pin clicks.
 */
export function MediaStopList({ media }: { media: MediaPin[] }) {
  if (media.length === 0) {
    return <p className="text-sm text-ink-muted">No stops on this walk yet.</p>;
  }

  return (
    <section aria-label="Stops along this walk" className="flex flex-col gap-3">
      <h2 className="font-medium">Stops</h2>
      <ol className="flex flex-col gap-3">
        {media.map((pin, i) => (
          <li
            key={pin.id}
            id={`stop-${pin.id}`}
            tabIndex={-1}
            className="rounded-xl border border-line bg-canvas p-3 focus:outline-2 focus:outline-focus"
          >
            <p className="mb-2 text-sm text-ink-muted">
              Stop {i + 1} of {media.length} ·{" "}
              {pin.kind === "photo" ? "Photo" : "Audio note"}
            </p>
            {pin.kind === "photo" ? (
              pin.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- storage URLs; alt text is user-authored
                <img
                  src={pin.url}
                  alt={pin.alt ?? ""}
                  className="w-full rounded-lg object-cover"
                />
              ) : (
                <p className="rounded-lg bg-wash p-3 text-sm">
                  Sign in to view this photo.
                </p>
              )
            ) : pin.url ? (
              <audio controls src={pin.url} className="w-full">
                Your browser does not support audio playback.
              </audio>
            ) : (
              <p className="rounded-lg bg-wash p-3 text-sm">
                Sign in to listen to this audio note.
              </p>
            )}
            {pin.caption && <p className="mt-2 text-sm">{pin.caption}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

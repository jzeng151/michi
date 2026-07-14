"use client";

import { Marker } from "react-map-gl/maplibre";
import type { WalkPin } from "@/lib/types";

/**
 * MapLibre gives every marker container role="button", so the visual here is
 * a non-interactive span (nesting a real button would be a nested-interactive
 * a11y violation). Mouse users can click the marker; keyboard/screen-reader
 * users use the equivalent stop list in the panel.
 */
export function MediaMarker({
  pin,
  index,
  onSelect,
}: {
  pin: WalkPin;
  index: number;
  onSelect?: (id: string) => void;
}) {
  return (
    <Marker
      longitude={pin.lng}
      latitude={pin.lat}
      anchor="bottom"
      onClick={onSelect ? () => onSelect(pin.id) : undefined}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      <span
        aria-hidden="true"
        className="block rounded-full border-2 border-surface bg-surface shadow-md transition-transform hover:scale-110"
      >
        {pin.kind === "photo" && pin.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage-signed URLs; next/image adds nothing here
          <img
            src={pin.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wash text-lg">
            {pin.kind === "photo"
              ? "🖼"
              : pin.kind === "audio"
                ? "🎙"
                : "📝"}
          </span>
        )}
      </span>
      <span className="sr-only">
        {(pin.listIndex ?? index) + 1}.{" "}
        {pin.kind === "note"
          ? `Note: ${pin.note}`
          : `${pin.kind === "photo" ? "Photo" : "Audio"}: ${pin.alt ?? pin.caption ?? pin.kind}`}
      </span>
    </Marker>
  );
}

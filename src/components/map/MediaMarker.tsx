"use client";

import { Marker } from "react-map-gl/maplibre";
import type { MediaPin } from "@/lib/types";

export function MediaMarker({
  pin,
  index,
  onSelect,
}: {
  pin: MediaPin;
  index: number;
  onSelect?: (id: string) => void;
}) {
  const label =
    pin.kind === "photo"
      ? `Photo stop ${index + 1}: ${pin.alt ?? pin.caption ?? "photo"}`
      : `Audio note ${index + 1}${pin.caption ? `: ${pin.caption}` : ""}`;

  return (
    <Marker longitude={pin.lng} latitude={pin.lat} anchor="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={() => onSelect?.(pin.id)}
        className="block cursor-pointer rounded-full border-2 border-surface bg-surface shadow-md transition-transform hover:scale-110"
      >
        {pin.kind === "photo" && pin.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage-signed URLs; next/image adds nothing here
          <img
            src={pin.url}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-wash text-lg"
          >
            {pin.kind === "photo" ? "🖼" : "🎙"}
          </span>
        )}
      </button>
    </Marker>
  );
}

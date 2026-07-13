"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  requestCenterPoint,
  setMapClickHandler,
  setMapDisplay,
} from "@/components/map/display-store";
import { MediaCapture, type CapturedMedia } from "@/components/media/MediaCapture";
import { pathDistance } from "@/lib/geo";
import { extForMime } from "@/lib/media-url";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { formatDistance } from "@/lib/format";
import { photoAltSchema, walkFormSchema } from "@/lib/validation";

type StagedMedia = CapturedMedia & {
  id: string;
  altText: string;
  caption: string;
  pointIndex: number;
};

const button =
  "rounded-full border border-line px-4 py-2 text-sm transition-colors hover:bg-wash disabled:opacity-50 disabled:hover:bg-transparent";
const primaryButton =
  "rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60";

export function CreateWalkPanel() {
  const router = useRouter();
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [staged, setStaged] = useState<StagedMedia[]>([]);
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const pathCoords = drawPoints;

  // Map clicks append waypoints.
  useEffect(() => {
    if (saving) return;
    setMapClickHandler((lngLat) => setDrawPoints((p) => [...p, lngLat]));
    return () => setMapClickHandler(null);
  }, [saving]);

  // Publish the draft to the map.
  useEffect(() => {
    setMapDisplay({
      kind: "draft",
      coordinates: pathCoords,
      media: staged.map((m) => ({
        id: m.id,
        kind: m.kind,
        url: m.previewUrl,
        alt: m.altText || null,
        caption: m.caption || null,
        lng: pathCoords[m.pointIndex]?.[0] ?? 0,
        lat: pathCoords[m.pointIndex]?.[1] ?? 0,
      })),
      position: null,
    });
  }, [pathCoords, staged]);

  useEffect(() => () => setMapDisplay(null), []);

  const distanceM = useMemo(() => pathDistance(pathCoords), [pathCoords]);

  const movePoint = useCallback((index: number, dir: -1 | 1) => {
    setDrawPoints((pts) => {
      const next = [...pts];
      const target = index + dir;
      if (target < 0 || target >= next.length) return pts;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const removePoint = useCallback((index: number) => {
    setDrawPoints((pts) => pts.filter((_, i) => i !== index));
    // Media pinned after the removed point shifts down one; save-time and
    // render-time clamping handles the last-point edge.
    setStaged((items) =>
      items.map((m) =>
        m.pointIndex > index ? { ...m, pointIndex: m.pointIndex - 1 } : m,
      ),
    );
  }, []);

  function onCapture(media: CapturedMedia) {
    setStaged((items) => [
      ...items,
      {
        ...media,
        id: crypto.randomUUID(),
        altText: "",
        caption: "",
        pointIndex: Math.max(pathCoords.length - 1, 0),
      },
    ]);
  }

  function updateStaged(id: string, patch: Partial<StagedMedia>) {
    setStaged((items) =>
      items.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }

  function removeStaged(id: string) {
    setStaged((items) => {
      const item = items.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return items.filter((m) => m.id !== id);
    });
  }

  async function save() {
    setSaveMessage(null);
    const nextErrors: Record<string, string> = {};

    const parsed = walkFormSchema.safeParse({
      title,
      region,
      description,
      visibility,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        nextErrors[String(issue.path[0])] = issue.message;
      }
    }
    if (pathCoords.length < 2) {
      nextErrors.path = "A walk needs at least two points.";
    }
    for (const m of staged) {
      if (m.kind === "photo" && !photoAltSchema.safeParse(m.altText).success) {
        nextErrors[`alt-${m.id}`] =
          "Describe this photo for people who can't see it.";
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveMessage("Your session expired. Sign in again.");
      setSaving(false);
      return;
    }

    const values = parsed.data!;
    const { data: walk, error: walkError } = await supabase
      .from("walks")
      .insert({
        owner_id: user.id,
        title: values.title,
        region: values.region || null,
        description: values.description || null,
        path: {
          type: "LineString",
          coordinates: pathCoords,
        } as unknown as Json,
        distance_m: distanceM,
        duration_s: null,
        visibility: values.visibility,
      })
      .select("id")
      .single();

    if (walkError || !walk) {
      setSaveMessage(`Couldn't save the walk: ${walkError?.message}`);
      setSaving(false);
      return;
    }

    const failures: string[] = [];
    for (const [i, m] of staged.entries()) {
      const ext = extForMime(m.mime);
      if (!ext) {
        failures.push(`item ${i + 1}: unsupported type ${m.mime}`);
        continue;
      }
      const storagePath = `${user.id}/${walk.id}/${m.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("walk-media")
        .upload(storagePath, m.file, { contentType: m.mime });
      if (uploadError) {
        failures.push(`item ${i + 1}: ${uploadError.message}`);
        continue;
      }
      const [lng, lat] =
        pathCoords[Math.min(m.pointIndex, pathCoords.length - 1)];
      const { data: stop, error: stopError } = await supabase
        .from("walk_stops")
        .insert({
          walk_id: walk.id,
          kind: m.kind,
          sort_index: i,
          lat,
          lng,
          note: m.caption || null,
        })
        .select("id")
        .single();
      if (stopError || !stop) {
        failures.push(`item ${i + 1}: ${stopError?.message}`);
        continue;
      }
      const { error: rowError } = await supabase.from("walk_media").insert({
        stop_id: stop.id,
        bucket: "walk-media",
        storage_path: storagePath,
        alt_text: m.kind === "photo" ? m.altText : null,
        original_filename: m.originalName,
        mime_type: m.mime,
      });
      if (rowError) failures.push(`item ${i + 1}: ${rowError.message}`);
    }

    staged.forEach((m) => URL.revokeObjectURL(m.previewUrl));

    if (failures.length > 0) {
      setSaveMessage(
        `Walk saved, but some media failed: ${failures.join("; ")}`,
      );
      setSaving(false);
      return;
    }
    router.push(`/dashboard/walks/${walk.id}`);
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <Link
        href="/dashboard"
        className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
      >
        ← All walks
      </Link>
      <h1 className="font-display text-2xl font-semibold">New walk</h1>

      <section aria-label="Waypoints" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">
          Tap the map to add points along your route, or use the button below
          to drop a point at the map&apos;s center crosshair.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={requestCenterPoint}>
            ＋ Add point at map center
          </button>
          <button
            type="button"
            className={button}
            disabled={drawPoints.length === 0}
            onClick={() => setDrawPoints((p) => p.slice(0, -1))}
          >
            Undo last
          </button>
          <button
            type="button"
            className={button}
            disabled={drawPoints.length === 0}
            onClick={() => setDrawPoints([])}
          >
            Clear
          </button>
        </div>
        <p className="text-sm" aria-live="polite">
          {drawPoints.length} point{drawPoints.length === 1 ? "" : "s"} ·{" "}
          {formatDistance(distanceM)}
        </p>
        {errors.path && <p className="text-sm text-accent-text">{errors.path}</p>}
        {drawPoints.length > 0 && (
          <ol className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {drawPoints.map(([lng, lat], i) => (
              <li
                key={`${lng}-${lat}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-1.5 text-sm"
              >
                <span>
                  Point {i + 1}{" "}
                  <span className="text-ink-muted">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </span>
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Move point ${i + 1} earlier`}
                    className="rounded px-2 py-0.5 hover:bg-wash disabled:opacity-40"
                    disabled={i === 0}
                    onClick={() => movePoint(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move point ${i + 1} later`}
                    className="rounded px-2 py-0.5 hover:bg-wash disabled:opacity-40"
                    disabled={i === drawPoints.length - 1}
                    onClick={() => movePoint(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove point ${i + 1}`}
                    className="rounded px-2 py-0.5 hover:bg-wash"
                    onClick={() => removePoint(i)}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="Photos" className="flex flex-col gap-3">
        <h2 className="font-medium">Memories along the way</h2>
        {pathCoords.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Add route points first, then attach photos to them.
          </p>
        ) : (
          <MediaCapture onCapture={onCapture} showAudio={false} />
        )}
        {staged.length > 0 && (
          <ul className="flex flex-col gap-3">
            {staged.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-3"
              >
                {m.kind === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img
                    src={m.previewUrl}
                    alt={m.altText || "Photo awaiting description"}
                    className="max-h-40 w-full rounded-lg object-cover"
                  />
                ) : (
                  <audio controls src={m.previewUrl} className="w-full" />
                )}
                {m.kind === "photo" && (
                  <label className="flex flex-col gap-1 text-sm">
                    Photo description (required)
                    <input
                      value={m.altText}
                      onChange={(e) =>
                        updateStaged(m.id, { altText: e.target.value })
                      }
                      className={inputClass}
                      aria-invalid={Boolean(errors[`alt-${m.id}`])}
                    />
                    {errors[`alt-${m.id}`] && (
                      <span className="text-accent-text">
                        {errors[`alt-${m.id}`]}
                      </span>
                    )}
                  </label>
                )}
                <label className="flex flex-col gap-1 text-sm">
                  Caption (optional)
                  <input
                    value={m.caption}
                    onChange={(e) =>
                      updateStaged(m.id, { caption: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Location on route
                  <select
                    value={Math.min(m.pointIndex, pathCoords.length - 1)}
                    onChange={(e) =>
                      updateStaged(m.id, {
                        pointIndex: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  >
                    {pathCoords.map((_, i) => (
                      <option key={i} value={i}>
                        Point {i + 1} of {pathCoords.length}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="self-start text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
                  onClick={() => removeStaged(m.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Walk details" className="flex flex-col gap-3">
        <h2 className="font-medium">Details</h2>
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.title)}
          />
          {errors.title && <span className="text-accent-text">{errors.title}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Region (optional)
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Kyoto"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </label>
        <fieldset className="flex gap-2">
          <legend className="mb-2 text-sm">Who can see this walk?</legend>
          {(
            [
              ["private", "Only me"],
              ["public", "Everyone"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors ${
                visibility === value
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line hover:bg-wash"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                checked={visibility === value}
                onChange={() => setVisibility(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      <div aria-live="polite">
        {saveMessage && (
          <p className="rounded-lg bg-wash px-3 py-2 text-sm">{saveMessage}</p>
        )}
      </div>

      <button
        type="button"
        className={primaryButton}
        disabled={saving}
        onClick={save}
      >
        {saving ? "Saving…" : "Save walk"}
      </button>
    </div>
  );
}

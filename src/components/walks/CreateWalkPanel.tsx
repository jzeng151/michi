"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  requestCenterPoint,
  setMapClickHandler,
  setMapDisplay,
} from "@/components/map/display-store";
import { MediaCapture } from "@/components/media/MediaCapture";
import { lineStringFromCoordinates, pathDistance } from "@/lib/geo";
import { extForMime } from "@/lib/media-url";
import {
  hasBrowserPreview,
  parsePhotoBatch,
  photoMime,
  sortPhotoImports,
  type PhotoImportResult,
} from "@/lib/photo-import";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { formatDistance } from "@/lib/format";
import { photoAltSchema, walkFormSchema } from "@/lib/validation";

type StagedMedia = {
  id: string;
  file: File;
  originalName: string;
  mime: string | null;
  previewUrl: string | null;
  originalIndex: number;
  status: "parsing" | "ready" | "error";
  error: string | null;
  capturedAt: string | null;
  lat: number | null;
  lng: number | null;
  orientation: number | null;
  altText: string;
  caption: string;
  pointIndex: number | null;
};

function locationOf(
  media: StagedMedia,
  points: [number, number][],
): [number, number] | null {
  if (media.pointIndex !== null) return points[media.pointIndex] ?? null;
  return media.lat !== null && media.lng !== null
    ? [media.lng, media.lat]
    : null;
}

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
  const nextImportIndex = useRef(0);
  const previewUrls = useRef(new Set<string>());

  const importing = staged.some((item) => item.status === "parsing");
  const photoPoints = useMemo(
    () =>
      staged.flatMap((item) => {
        if (item.status !== "ready") return [];
        const point = locationOf(item, drawPoints);
        return point ? [point] : [];
      }),
    [drawPoints, staged],
  );
  const pathCoords = drawPoints.length >= 2 ? drawPoints : photoPoints;

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
      waypoints: drawPoints.length > 0 ? drawPoints : photoPoints,
      media: staged.flatMap((m, listIndex) => {
        const point = locationOf(m, drawPoints);
        return m.status === "ready" && point
          ? [
              {
                id: m.id,
                kind: "photo" as const,
                url: m.previewUrl,
                mimeType: m.mime,
                alt: m.altText || null,
                caption: m.caption || null,
                lng: point[0],
                lat: point[1],
                listIndex,
              },
            ]
          : [];
      }),
      position: null,
    });
  }, [drawPoints, pathCoords, photoPoints, staged]);

  useEffect(
    () => () => {
      setMapDisplay(null);
      previewUrls.current.forEach(URL.revokeObjectURL);
    },
    [],
  );

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
    setStaged((items) =>
      items.map((m) => {
        if (m.pointIndex === null || m.pointIndex < index) return m;
        return {
          ...m,
          pointIndex: m.pointIndex === index ? null : m.pointIndex - 1,
        };
      }),
    );
  }, []);

  function onPhotos(files: File[]) {
    const startIndex = nextImportIndex.current;
    nextImportIndex.current += files.length;
    const ids = files.map(() => crypto.randomUUID());
    const placeholders = files.map((file, position): StagedMedia => {
      const mime = photoMime(file);
      const previewUrl = hasBrowserPreview(mime)
        ? URL.createObjectURL(file)
        : null;
      if (previewUrl) previewUrls.current.add(previewUrl);
      return {
        id: ids[position],
        file,
        originalName: file.name,
        mime,
        previewUrl,
        originalIndex: startIndex + position,
        status: "parsing",
        error: null,
        capturedAt: null,
        lat: null,
        lng: null,
        orientation: null,
        altText: "",
        caption: "",
        pointIndex: null,
      };
    });
    setStaged((items) => sortPhotoImports([...items, ...placeholders]));

    void parsePhotoBatch(files, startIndex, (result: PhotoImportResult) => {
      const id = ids[result.originalIndex - startIndex];
      setStaged((items) =>
        sortPhotoImports(
          items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  mime: result.mime,
                  status: result.status,
                  error: result.error,
                  capturedAt: result.capturedAt,
                  lat: result.lat,
                  lng: result.lng,
                  orientation: result.orientation,
                }
              : item,
          ),
        ),
      );
    });
  }

  function updateStaged(id: string, patch: Partial<StagedMedia>) {
    setStaged((items) =>
      items.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }

  function removeStaged(id: string) {
    setStaged((items) => {
      const item = items.find((m) => m.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrls.current.delete(item.previewUrl);
      }
      return items.filter((m) => m.id !== id);
    });
  }

  async function save() {
    setSaveMessage(null);
    const nextErrors: Record<string, string> = {};
    const ready = staged.filter((item) => item.status === "ready");

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
    if (importing) {
      nextErrors.import = "Wait for photo metadata to finish before saving.";
    } else if (staged.some((item) => item.status === "error")) {
      nextErrors.import = "Remove failed files before saving.";
    } else if (ready.length === 0 && pathCoords.length < 2) {
      nextErrors.import = "Add at least one photo or two route points before saving.";
    }
    for (const m of ready) {
      if (!photoAltSchema.safeParse(m.altText).success) {
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
    const path = lineStringFromCoordinates(pathCoords);
    const { data: walk, error: walkError } = await supabase
      .from("walks")
      .insert({
        owner_id: user.id,
        title: values.title,
        region: values.region || null,
        description: values.description || null,
        path: path as unknown as Json,
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
    for (const [i, m] of ready.entries()) {
      if (!m.mime) continue;
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
      const [lng, lat] = locationOf(m, drawPoints) ?? [null, null];
      const { data: stop, error: stopError } = await supabase
        .from("walk_stops")
        .insert({
          walk_id: walk.id,
          kind: "photo",
          sort_index: i,
          lat,
          lng,
          captured_at: m.capturedAt,
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
        alt_text: m.altText,
        original_filename: m.originalName,
        mime_type: m.mime,
        orientation: m.orientation,
      });
      if (rowError) failures.push(`item ${i + 1}: ${rowError.message}`);
    }

    if (failures.length > 0) {
      setSaveMessage(
        `Walk saved, but some media failed: ${failures.join("; ")}`,
      );
      setSaving(false);
      return;
    }
    previewUrls.current.forEach(URL.revokeObjectURL);
    previewUrls.current.clear();
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
          Photo locations build the route automatically. Tap the map to add or
          adjust points, or use the map&apos;s center crosshair.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={requestCenterPoint}>
            ＋ Add point at map center
          </button>
          <button
            type="button"
            className={button}
            disabled={drawPoints.length === 0}
            onClick={() => removePoint(drawPoints.length - 1)}
          >
            Undo last
          </button>
          <button
            type="button"
            className={button}
            disabled={drawPoints.length === 0}
            onClick={() => {
              setDrawPoints([]);
              setStaged((items) =>
                items.map((item) => ({ ...item, pointIndex: null })),
              );
            }}
          >
            Clear
          </button>
        </div>
        <p className="text-sm" aria-live="polite">
          {drawPoints.length} manual point{drawPoints.length === 1 ? "" : "s"}
          {" · "}
          {formatDistance(distanceM)} route
        </p>
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
        <MediaCapture
          onPhotos={onPhotos}
          showAudio={false}
          disabled={saving || importing}
        />
        {staged.length > 0 && (
          <>
            <p className="text-sm" aria-live="polite">
              {staged.filter((item) => item.status !== "parsing").length} of{" "}
              {staged.length} photos processed
            </p>
            <ul aria-label="Import queue" className="flex flex-col gap-3">
              {staged.map((m) => {
                const location = locationOf(m, drawPoints);
                return (
                  <li
                    key={m.id}
                    data-status={m.status}
                    className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-3"
                  >
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">
                        {m.originalName}
                      </span>
                      <span className="shrink-0 text-ink-muted">
                        {m.status === "parsing"
                          ? "Reading metadata…"
                          : m.status === "error"
                            ? "Failed"
                            : location
                              ? "Located"
                              : "Needs placement"}
                      </span>
                    </div>

                    {m.status === "error" ? (
                      <p
                        role="alert"
                        className="break-words text-sm text-accent-text"
                      >
                        {m.error}
                      </p>
                    ) : m.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                      <img
                        src={m.previewUrl}
                        alt={m.altText || "Photo awaiting description"}
                        loading="lazy"
                        decoding="async"
                        className="max-h-40 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <p className="rounded-lg bg-wash p-4 text-sm text-ink-muted">
                        HEIC preview unavailable; metadata and the original file
                        are retained.
                      </p>
                    )}

                    {m.status === "ready" && (
                      <>
                        {m.capturedAt && (
                          <p className="text-xs text-ink-muted">
                            Captured{" "}
                            <time dateTime={m.capturedAt}>
                              {new Date(m.capturedAt).toLocaleString()}
                            </time>
                          </p>
                        )}
                        <p className="text-xs text-ink-muted">
                          {location
                            ? `${location[1].toFixed(5)}, ${location[0].toFixed(5)}`
                            : "No location metadata found."}
                        </p>
                        <label className="flex flex-col gap-1 text-sm">
                          Photo description (required)
                          <input
                            value={m.altText}
                            onChange={(e) =>
                              updateStaged(m.id, { altText: e.target.value })
                            }
                            className={inputClass}
                            required
                            aria-invalid={Boolean(errors[`alt-${m.id}`])}
                            aria-errormessage={
                              errors[`alt-${m.id}`]
                                ? `alt-error-${m.id}`
                                : undefined
                            }
                          />
                          {errors[`alt-${m.id}`] && (
                            <span
                              id={`alt-error-${m.id}`}
                              className="text-accent-text"
                            >
                              {errors[`alt-${m.id}`]}
                            </span>
                          )}
                        </label>
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
                        {drawPoints.length > 0 && (
                          <label className="flex flex-col gap-1 text-sm">
                            Location on route
                            <select
                              value={m.pointIndex ?? ""}
                              onChange={(e) =>
                                updateStaged(m.id, {
                                  pointIndex:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              className={inputClass}
                            >
                              <option value="">
                                {m.lat !== null
                                  ? "Photo metadata location"
                                  : "Needs placement"}
                              </option>
                              {drawPoints.map((_, i) => (
                                <option key={i} value={i}>
                                  Point {i + 1} of {drawPoints.length}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${m.originalName}`}
                      className="min-h-11 self-start text-sm text-ink-muted underline underline-offset-4 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={m.status === "parsing"}
                      onClick={() => removeStaged(m.id)}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {errors.import && (
          <p role="alert" className="text-sm text-accent-text">
            {errors.import}
          </p>
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
        disabled={saving || importing}
        onClick={save}
      >
        {saving ? "Saving…" : "Save walk"}
      </button>
    </div>
  );
}

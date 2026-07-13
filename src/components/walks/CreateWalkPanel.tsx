"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  requestCenterPoint,
  setMapClickHandler,
  setMapDisplay,
} from "@/components/map/display-store";
import { MediaCapture } from "@/components/media/MediaCapture";
import { formatDistance } from "@/lib/format";
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
import {
  browserDraftRepository,
  isValidCoordinate,
  newWalkDraft,
  orderDraftStops,
  photosToUpload,
  type DraftPhoto,
  type DraftUpload,
  type OrderedDraftStop,
  type WalkDraft,
} from "@/lib/walk-draft";
import { uploadDraftPhotos } from "@/lib/walk-save";
import { photoAltSchema, stopNoteSchema, walkFormSchema } from "@/lib/validation";

const button =
  "min-h-11 rounded-full border border-line px-4 py-2 text-sm transition-colors hover:bg-wash disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";
const primaryButton =
  "min-h-11 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-base text-ink placeholder:text-ink-muted sm:text-sm";

function hasLocation(stop: { lng: number | null; lat: number | null }) {
  return isValidCoordinate(stop.lng, stop.lat);
}

function storagePath(userId: string, draftId: string, photo: DraftPhoto) {
  const extension = photo.mime ? extForMime(photo.mime) : null;
  if (!extension) throw new Error(`Unsupported photo type: ${photo.mime ?? "unknown"}`);
  return `${userId}/${draftId}/${photo.id}.${extension}`;
}

function uploadLabel(upload: DraftUpload) {
  if (upload.status === "uploading") return `Uploading ${upload.progress}%`;
  if (upload.status === "uploaded") return "Uploaded";
  if (upload.status === "error") return "Upload failed";
  return "Queued";
}

export function CreateWalkPanel({ userId }: { userId: string }) {
  const router = useRouter();
  const repository = useMemo(() => browserDraftRepository(), []);
  const [draft, setDraft] = useState<WalkDraft | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [placementMessage, setPlacementMessage] = useState<string | null>(null);
  const [restoreFailure, setRestoreFailure] = useState<string | null>(null);
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null);
  const [confirmedWalkId, setConfirmedWalkId] = useState<string | null>(null);
  const [existingWalkId, setExistingWalkId] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const previewUrls = useRef(new Set<string>());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistQueue = useRef<Promise<void>>(Promise.resolve());
  const draftRef = useRef<WalkDraft | null>(null);
  const skipFlush = useRef(false);
  const browserRecoveryEnabled = useRef(true);

  const updateDraft = useCallback((change: (current: WalkDraft) => WalkDraft) => {
    setDraft((current) => (current ? change(current) : current));
  }, []);

  const updatePhoto = useCallback(
    (id: string, patch: Partial<DraftPhoto>) => {
      updateDraft((current) => ({
        ...current,
        photos: current.photos.map((photo) =>
          photo.id === id ? { ...photo, ...patch } : photo,
        ),
      }));
    },
    [updateDraft],
  );

  const persist = useCallback(
    (value: WalkDraft) => {
      if (!browserRecoveryEnabled.current) return Promise.resolve();
      const next = persistQueue.current
        .catch(() => undefined)
        .then(() => repository.save(value));
      persistQueue.current = next;
      return next;
    },
    [repository],
  );

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const flush = () => {
      if (draftRef.current && !skipFlush.current) {
        void persist(draftRef.current);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [persist]);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const restored = await repository.restore(userId);
        if (!active) return;
        let notice = restored ? "Draft restored from this browser." : null;
        if (restored) {
          const confirmation = await createClient()
            .from("walks")
            .select("id")
            .eq("id", restored.id)
            .maybeSingle();
          if (confirmation.error) {
            setConfirmationPending(true);
            notice = `Draft restored, but its saved status couldn't be confirmed: ${confirmation.error.message}. You can keep editing; we'll check again when you save.`;
          } else if (confirmation.data) {
            setExistingWalkId(restored.id);
            notice =
              "This browser draft belongs to a saved walk. Open the saved walk, or continue editing and save to update it.";
          }
        }
        const value = restored ?? newWalkDraft(userId);
        const nextPreviews: Record<string, string> = {};
        for (const photo of value.photos) {
          if (!hasBrowserPreview(photo.mime)) continue;
          const url = URL.createObjectURL(photo.file);
          previewUrls.current.add(url);
          nextPreviews[photo.id] = url;
        }
        setPreviews(nextPreviews);
        setDraft(value);
        if (notice) setDraftNotice(notice);

        const interrupted = value.photos.filter(
          ({ status }) => status === "parsing",
        );
        if (interrupted.length > 0) {
          void parsePhotoBatch(
            interrupted.map(({ file }) => file),
            0,
            (result) => {
              const photo = interrupted[result.originalIndex];
              if (!photo) return;
              updatePhoto(photo.id, {
                mime: result.mime,
                status: result.status,
                error: result.error,
                capturedAt: result.capturedAt,
                lat: result.lat,
                lng: result.lng,
                orientation: result.orientation,
              });
            },
          );
        }
      } catch (error) {
        if (!active) return;
        setRestoreFailure(
          `Couldn't restore the browser draft: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    void restore();
    return () => {
      active = false;
    };
  }, [repository, updatePhoto, userId]);

  useEffect(() => {
    if (!draft || saving) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void persist(draft).then(
        () => {
          if (browserRecoveryEnabled.current) setStorageError(null);
        },
        (error) =>
          setStorageError(
            `Couldn't save the browser draft: ${error instanceof Error ? error.message : "Unknown error"}`,
          ),
      );
    }, 400);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [draft, persist, saving]);

  useEffect(
    () => () => {
      setMapClickHandler(null);
      setMapDisplay(null);
      previewUrls.current.forEach(URL.revokeObjectURL);
    },
    [],
  );

  const orderedStops = useMemo(
    () => (draft ? orderDraftStops(draft) : []),
    [draft],
  );
  const placedStops = useMemo(
    () => orderedStops.filter(hasLocation),
    [orderedStops],
  );
  const unplacedStops = useMemo(
    () => orderedStops.filter((stop) => !hasLocation(stop)),
    [orderedStops],
  );
  const pathCoords = useMemo(
    () => placedStops.map(({ lng, lat }) => [lng!, lat!] as [number, number]),
    [placedStops],
  );
  const distanceM = useMemo(() => pathDistance(pathCoords), [pathCoords]);
  const importing = draft?.photos.some(({ status }) => status === "parsing") ?? false;
  const readyPhotos = draft?.photos.filter(({ status }) => status === "ready") ?? [];
  const uploadedCount = readyPhotos.filter(
    ({ upload }) => upload.status === "uploaded",
  ).length;
  const selectedStop = orderedStops.find(
    (stop) =>
      (stop.kind === "photo" ? stop.stopId : stop.id) === selectedStopId,
  );
  const selectedName = selectedStop
    ? selectedStop.kind === "photo"
      ? selectedStop.originalName
      : selectedStop.text.trim() || "Untitled note"
    : null;

  useEffect(() => {
    if (!draft || saving || !selectedStopId) {
      setMapClickHandler(null);
      return;
    }
    setMapClickHandler(([lng, lat]) => {
      if (!isValidCoordinate(lng, lat)) {
        setPlacementMessage("The map returned an invalid location. Try again.");
        return;
      }
      updateDraft((current) => ({
        ...current,
        photos: current.photos.map((photo) =>
          photo.stopId === selectedStopId ? { ...photo, lng, lat } : photo,
        ),
        notes: current.notes.map((note) =>
          note.id === selectedStopId ? { ...note, lng, lat } : note,
        ),
      }));
      setPlacementMessage(
        `Placed ${selectedName ?? "stop"} at ${lat.toFixed(5)}, ${lng.toFixed(5)}.`,
      );
    });
    return () => setMapClickHandler(null);
  }, [draft, saving, selectedName, selectedStopId, updateDraft]);

  useEffect(() => {
    setMapDisplay(
      draft
        ? {
            kind: "draft",
            coordinates: pathCoords,
            waypoints: placedStops.flatMap((stop) =>
              stop.kind === "note"
                ? [[stop.lng!, stop.lat!] as [number, number]]
                : [],
            ),
            media: orderedStops.flatMap((stop, listIndex) =>
              stop.kind === "photo" && hasLocation(stop)
                ? [
                    {
                      id: stop.id,
                      kind: "photo" as const,
                      url: previews[stop.id] ?? null,
                      mimeType: stop.mime,
                      alt: stop.altText || null,
                      caption: stop.caption || null,
                      lng: stop.lng!,
                      lat: stop.lat!,
                      listIndex,
                    },
                  ]
                : [],
            ),
            position: null,
          }
        : null,
    );
  }, [draft, orderedStops, pathCoords, placedStops, previews]);

  function onPhotos(files: File[]) {
    if (!draft) return;
    const startIndex = draft.nextIndex;
    const ids = files.map(() => crypto.randomUUID());
    const stopIds = files.map(() => crypto.randomUUID());
    const placeholders = files.map((file, position): DraftPhoto => {
      const mime = photoMime(file);
      if (hasBrowserPreview(mime)) {
        const url = URL.createObjectURL(file);
        previewUrls.current.add(url);
        setPreviews((current) => ({ ...current, [ids[position]]: url }));
      }
      return {
        id: ids[position],
        stopId: stopIds[position],
        file,
        originalName: file.name,
        mime,
        originalIndex: startIndex + position,
        status: "parsing",
        error: null,
        capturedAt: null,
        lat: null,
        lng: null,
        orientation: null,
        altText: "",
        caption: "",
        upload: {
          status: "pending",
          progress: 0,
          error: null,
          attempted: false,
        },
      };
    });
    updateDraft((current) => ({
      ...current,
      nextIndex: Math.max(current.nextIndex, startIndex + files.length),
      photos: sortPhotoImports([...current.photos, ...placeholders]),
    }));

    void parsePhotoBatch(files, startIndex, (result: PhotoImportResult) => {
      const id = ids[result.originalIndex - startIndex];
      updateDraft((current) => ({
        ...current,
        photos: sortPhotoImports(
          current.photos.map((photo) =>
            photo.id === id
              ? {
                  ...photo,
                  mime: result.mime,
                  status: result.status,
                  error: result.error,
                  capturedAt: result.capturedAt,
                  lat: result.lat,
                  lng: result.lng,
                  orientation: result.orientation,
                }
              : photo,
          ),
        ),
      }));
    });
  }

  function addNote() {
    if (!draft || saving || removingPhotoId || confirmedWalkId) return;
    const id = crypto.randomUUID();
    updateDraft((current) => ({
      ...current,
      nextIndex: current.nextIndex + 1,
      notes: [
        ...current.notes,
        { id, originalIndex: current.nextIndex, text: "", lat: null, lng: null },
      ],
    }));
    setSelectedStopId(id);
    setPlacementMessage("Note added and selected for placement.");
    requestAnimationFrame(() => document.getElementById(`note-${id}`)?.focus());
  }

  async function removePhoto(photo: DraftPhoto) {
    if (!draft || saving || removingPhotoId || confirmedWalkId) return;
    if (existingWalkId || confirmationPending) {
      setSaveMessage(
        "Photo removal is disabled while this draft may already belong to a saved walk.",
      );
      return;
    }
    setRemovingPhotoId(photo.id);
    try {
      if (photo.upload.attempted && photo.mime && extForMime(photo.mime)) {
        const supabase = createClient();
        const { error } = await supabase.storage
          .from("walk-media")
          .remove([storagePath(userId, draft.id, photo)]);
        if (error) {
          setSaveMessage(`Couldn't remove ${photo.originalName}: ${error.message}`);
          return;
        }
      }
      const preview = previews[photo.id];
      if (preview) {
        URL.revokeObjectURL(preview);
        previewUrls.current.delete(preview);
        setPreviews((current) => {
          const next = { ...current };
          delete next[photo.id];
          return next;
        });
      }
      updateDraft((current) => ({
        ...current,
        photos: current.photos.filter(({ id }) => id !== photo.id),
      }));
      if (selectedStopId === photo.stopId) setSelectedStopId(null);
    } finally {
      setRemovingPhotoId(null);
    }
  }

  function removeNote(id: string) {
    updateDraft((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== id),
    }));
    if (selectedStopId === id) setSelectedStopId(null);
  }

  function clearLocation(stopId: string) {
    updateDraft((current) => ({
      ...current,
      photos: current.photos.map((photo) =>
        photo.stopId === stopId ? { ...photo, lng: null, lat: null } : photo,
      ),
      notes: current.notes.map((note) =>
        note.id === stopId ? { ...note, lng: null, lat: null } : note,
      ),
    }));
    setPlacementMessage("Location cleared. The stop is back in the Unplaced tray.");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-placement-stop="${stopId}"]`)
        ?.focus(),
    );
  }

  function validate(value: WalkDraft) {
    const nextErrors: Record<string, string> = {};
    const parsed = walkFormSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        nextErrors[String(issue.path[0])] = issue.message;
      }
    }
    if (value.photos.some(({ status }) => status === "parsing")) {
      nextErrors.import = "Wait for photo metadata to finish before saving.";
    } else if (value.photos.some(({ status }) => status === "error")) {
      nextErrors.import = "Remove failed files before saving.";
    } else if (orderDraftStops(value).length === 0) {
      nextErrors.import = "Add at least one photo or note before saving.";
    }
    for (const photo of value.photos.filter(({ status }) => status === "ready")) {
      if (!photoAltSchema.safeParse(photo.altText).success) {
        nextErrors[`alt-${photo.id}`] =
          "Describe this photo for people who can't see it.";
      }
      if (photo.caption && !stopNoteSchema.safeParse(photo.caption).success) {
        nextErrors[`caption-${photo.id}`] = "Keep the caption under 2000 characters.";
      }
      if (photo.originalName.length > 255) {
        nextErrors.import = "A photo filename is longer than 255 characters.";
      }
      if (!photo.mime || !extForMime(photo.mime)) {
        nextErrors.import = `Unsupported photo type: ${photo.originalName}.`;
      }
      if (
        (photo.lng !== null || photo.lat !== null) &&
        !isValidCoordinate(photo.lng, photo.lat)
      ) {
        nextErrors[`location-${photo.stopId}`] = "Choose a valid map location.";
      }
    }
    for (const note of value.notes) {
      const parsedNote = stopNoteSchema.safeParse(note.text);
      if (!parsedNote.success) {
        nextErrors[`note-${note.id}`] = parsedNote.error.issues[0].message;
      }
      if (
        (note.lng !== null || note.lat !== null) &&
        !isValidCoordinate(note.lng, note.lat)
      ) {
        nextErrors[`location-${note.id}`] = "Choose a valid map location.";
      }
    }
    return { nextErrors, parsed };
  }

  function disableBrowserRecovery(error: unknown) {
    browserRecoveryEnabled.current = false;
    const message = error instanceof Error ? error.message : "Unknown error";
    setStorageError(`Couldn't save the browser draft: ${message}`);
    setDraftNotice(
      "Browser recovery stopped working. Keep this tab open until the walk is saved; any earlier browser draft was left untouched.",
    );
  }

  function startWithoutBrowserRecovery() {
    browserRecoveryEnabled.current = false;
    setConfirmationPending(false);
    previewUrls.current.forEach(URL.revokeObjectURL);
    previewUrls.current.clear();
    setPreviews({});
    setExistingWalkId(null);
    setRestoreFailure(null);
    setStorageError(null);
    setSaveMessage(null);
    setDraftNotice(
      "Started a new walk without browser recovery. The existing browser draft was left untouched.",
    );
    setDraft(newWalkDraft(userId));
  }

  async function persistForSave(value: WalkDraft) {
    try {
      await persist(value);
    } catch (error) {
      disableBrowserRecovery(error);
    }
  }

  async function finishSavedWalk(walkId: string) {
    skipFlush.current = true;
    setConfirmedWalkId(walkId);
    if (!browserRecoveryEnabled.current) {
      previewUrls.current.forEach(URL.revokeObjectURL);
      previewUrls.current.clear();
      router.push(`/dashboard/walks/${walkId}`);
      return;
    }
    try {
      await repository.clear(userId);
    } catch (error) {
      setStorageError(
        `Walk saved, but the browser draft couldn't be cleared: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setSaveMessage("The walk is saved. Retry cleanup or open it now.");
      setSaving(false);
      return;
    }
    previewUrls.current.forEach(URL.revokeObjectURL);
    previewUrls.current.clear();
    router.push(`/dashboard/walks/${walkId}`);
  }

  async function save() {
    if (!draft || saving || removingPhotoId || confirmedWalkId) return;
    setSaveMessage(null);
    const snapshot = draft;
    const { nextErrors, parsed } = validate(snapshot);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !parsed.success) {
      requestAnimationFrame(() => {
        const target =
          document.querySelector<HTMLElement>('[aria-invalid="true"]') ??
          document.getElementById("import-error");
        target?.focus();
      });
      return;
    }

    setSaving(true);
    await persistForSave(snapshot);

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (userError || sessionError || !user || !session || user.id !== userId) {
      setSaveMessage(
        browserRecoveryEnabled.current
          ? "Your session expired. Sign in again; this draft is saved on this browser."
          : "Your session expired. Sign in again before saving; this walk is only open in this tab.",
      );
      setSaving(false);
      return;
    }

    if (confirmationPending) {
      const confirmation = await supabase
        .from("walks")
        .select("id")
        .eq("id", snapshot.id)
        .maybeSingle();
      if (confirmation.error) {
        setSaveMessage(
          `Couldn't confirm whether this draft was already saved: ${confirmation.error.message}. Keep editing and retry when the connection is stable.`,
        );
        setSaving(false);
        return;
      }
      setConfirmationPending(false);
      if (confirmation.data) {
        setExistingWalkId(snapshot.id);
        setDraftNotice(
          "This draft already has a saved walk. Your local edits are still here; press Save again to update it, or open the saved walk.",
        );
        setSaving(false);
        return;
      }
    }

    let working = snapshot;
    const setUpload = (id: string, upload: DraftUpload) => {
      working = {
        ...working,
        photos: working.photos.map((photo) =>
          photo.id === id ? { ...photo, upload } : photo,
        ),
      };
      setDraft(working);
    };
    const pending = photosToUpload(working.photos);
    if (pending.length > 0) {
      const attempted = new Set(pending.map(({ id }) => id));
      working = {
        ...working,
        photos: working.photos.map((photo) =>
          attempted.has(photo.id)
            ? { ...photo, upload: { ...photo.upload, attempted: true } }
            : photo,
        ),
      };
      setDraft(working);
      await persistForSave(working);
    }
    const uploadResults = await uploadDraftPhotos(
      pending,
      (photo) => storagePath(userId, working.id, photo),
      session.access_token,
      setUpload,
    );
    await persistForSave(working);

    const failedUploads = uploadResults.filter(({ error }) => error !== null);
    if (failedUploads.length > 0) {
      setSaveMessage(
        `${failedUploads.length} photo${failedUploads.length === 1 ? "" : "s"} failed to upload. Retry save to upload only the failed items.`,
      );
      setSaving(false);
      return;
    }

    const stops = orderDraftStops(working);
    const coordinates = stops.flatMap((stop) =>
      hasLocation(stop) ? [[stop.lng!, stop.lat!] as [number, number]] : [],
    );
    const path = lineStringFromCoordinates(coordinates);
    const stopPayload = stops.map((stop, sortIndex) => {
      const common = {
        id: stop.kind === "photo" ? stop.stopId : stop.id,
        kind: stop.kind,
        sort_index: sortIndex,
        lat: stop.lat,
        lng: stop.lng,
      };
      return stop.kind === "note"
        ? { ...common, note: stop.text.trim() }
        : {
            ...common,
            captured_at: stop.capturedAt,
            note: stop.caption.trim() || null,
            media_id: stop.id,
            storage_path: storagePath(userId, working.id, stop),
            alt_text: stop.altText.trim(),
            original_filename: stop.originalName,
            mime_type: stop.mime,
            orientation: stop.orientation,
          };
    });
    const values = parsed.data;
    const { error: persistenceError } = await supabase.rpc("save_walk_draft", {
      p_walk_id: working.id,
      p_title: values.title,
      p_description: (values.description || null) as unknown as string,
      p_region: (values.region || null) as unknown as string,
      p_path: path as unknown as Json,
      p_distance_m: pathDistance(coordinates),
      p_visibility: values.visibility,
      p_stops: stopPayload as unknown as Json,
    });

    if (persistenceError) {
      const confirmation = await supabase
        .from("walks")
        .select("id")
        .eq("id", working.id)
        .maybeSingle();
      if (confirmation.error || confirmation.data) {
        await persistForSave(working);
        setSaveMessage(
          "Couldn't confirm the latest save. Nothing was deleted; retry safely when the connection is stable.",
        );
        setSaving(false);
        return;
      }

      const uploadedPhotos = working.photos.filter(
        ({ upload }) => upload.status === "uploaded",
      );
      const uploadedPaths = uploadedPhotos.map((photo) =>
        storagePath(userId, working.id, photo),
      );
      let cleanupError: string | null = null;
      if (uploadedPaths.length > 0) {
        const { error } = await supabase.storage
          .from("walk-media")
          .remove(uploadedPaths);
        cleanupError = error?.message ?? null;
        if (!error) {
          const cleaned = new Set(uploadedPhotos.map(({ id }) => id));
          working = {
            ...working,
            photos: working.photos.map((photo) =>
              cleaned.has(photo.id)
                ? {
                    ...photo,
                    upload: {
                      status: "pending",
                      progress: 0,
                      error: null,
                      attempted: false,
                    },
                  }
                : photo,
            ),
          };
          setDraft(working);
        }
      }
      let cleanupPersistenceError: string | null = null;
      try {
        await persist(working);
      } catch (error) {
        cleanupPersistenceError =
          error instanceof Error ? error.message : "Unknown error";
        disableBrowserRecovery(error);
      }
      setSaveMessage(
        `Couldn't save the walk: ${persistenceError.message}. ${cleanupError ? `Uploaded files remain tracked for retry because cleanup failed: ${cleanupError}` : cleanupPersistenceError ? "Cleanup finished, but its local status could not be recorded; retry will safely overwrite the same paths." : uploadedPaths.length > 0 ? "Uploaded files were cleaned up; the draft is ready to retry." : "The draft is ready to retry."}`,
      );
      setSaving(false);
      return;
    }

    await finishSavedWalk(working.id);
  }

  if (!draft && restoreFailure) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="font-display text-2xl font-semibold">Draft recovery failed</h1>
        <p role="alert" className="text-sm text-accent-text">
          {restoreFailure}
        </p>
        <p className="text-sm text-ink-muted">
          Retry the read, discard this browser copy, or start a new walk without
          browser recovery. Starting without recovery leaves any existing browser
          draft untouched, but the new walk only lasts in this tab until saved.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={() => window.location.reload()}>
            Retry restore
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              void repository.clear(userId).then(
                () => {
                  setRestoreFailure(null);
                  setDraft(newWalkDraft(userId));
                },
                (error) =>
                  setRestoreFailure(
                    `Couldn't discard the browser draft: ${error instanceof Error ? error.message : "Unknown error"}`,
                  ),
              );
            }}
          >
            Discard browser draft
          </button>
          <button
            type="button"
            className={button}
            onClick={startWithoutBrowserRecovery}
          >
            Start without browser recovery
          </button>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-4" role="status">
        Restoring your draft…
      </div>
    );
  }

  if (confirmedWalkId) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="font-display text-2xl font-semibold">Walk saved</h1>
        <p className="text-sm">
          The walk is safely stored, but its browser draft still needs cleanup.
        </p>
        {storageError && (
          <p role="alert" className="text-sm text-accent-text">
            {storageError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryButton}
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void repository.clear(userId).then(
                () => router.push(`/dashboard/walks/${confirmedWalkId}`),
                (error) => {
                  setStorageError(
                    `Couldn't clear the browser draft: ${error instanceof Error ? error.message : "Unknown error"}`,
                  );
                  setSaving(false);
                },
              );
            }}
          >
            {saving ? "Cleaning up…" : "Retry browser cleanup"}
          </button>
          <Link href={`/dashboard/walks/${confirmedWalkId}`} className={button}>
            Open saved walk
          </Link>
        </div>
      </div>
    );
  }

  function placementControls(stopId: string, located: boolean, name: string) {
    const selected = selectedStopId === stopId;
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          data-placement-stop={stopId}
          aria-pressed={selected}
          aria-label={`${selected ? "Selected for placement" : located ? "Reassign on map" : "Select for placement"}: ${name}`}
          disabled={saving || Boolean(removingPhotoId)}
          onClick={() => {
            setSelectedStopId(selected ? null : stopId);
            setPlacementMessage(
              selected ? "Placement selection cleared." : "Stop selected. Click the map or use the map-center button.",
            );
          }}
        >
          {selected ? "Selected for placement" : located ? "Reassign on map" : "Select for placement"}
        </button>
        {located && (
          <button
            type="button"
            className={button}
            aria-label={`Clear location: ${name}`}
            disabled={saving || Boolean(removingPhotoId)}
            onClick={() => clearLocation(stopId)}
          >
            Clear location
          </button>
        )}
      </div>
    );
  }

  function renderStop(stop: OrderedDraftStop) {
    const located = hasLocation(stop);
    if (stop.kind === "note") {
      return (
        <li
          key={stop.id}
          className={`flex flex-col gap-3 rounded-xl border bg-canvas p-3 ${selectedStopId === stop.id ? "border-accent" : "border-line"}`}
        >
          <div className="flex items-start justify-between gap-3 text-sm">
            <h3 className="font-medium">Note-only stop</h3>
            <span className="shrink-0 text-ink-muted">
              {located ? "Located" : "Needs placement"}
            </span>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Note
            <textarea
              id={`note-${stop.id}`}
              value={stop.text}
              rows={3}
              maxLength={2000}
              disabled={saving}
              className={inputClass}
              aria-label={`Note ${stop.originalIndex + 1}`}
              aria-invalid={Boolean(errors[`note-${stop.id}`])}
              aria-errormessage={
                errors[`note-${stop.id}`] ? `note-error-${stop.id}` : undefined
              }
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  notes: current.notes.map((note) =>
                    note.id === stop.id ? { ...note, text: event.target.value } : note,
                  ),
                }))
              }
            />
            {errors[`note-${stop.id}`] && (
              <span id={`note-error-${stop.id}`} className="text-accent-text">
                {errors[`note-${stop.id}`]}
              </span>
            )}
          </label>
          {located && (
            <p className="text-xs text-ink-muted">
              {stop.lat!.toFixed(5)}, {stop.lng!.toFixed(5)}
            </p>
          )}
          {errors[`location-${stop.id}`] && (
            <p role="alert" className="text-sm text-accent-text">
              {errors[`location-${stop.id}`]}
            </p>
          )}
          {placementControls(
            stop.id,
            located,
            `note ${stop.originalIndex + 1}`,
          )}
          <button
            type="button"
            aria-label={`Remove note ${stop.originalIndex + 1}`}
            className="min-h-11 self-start text-sm text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-50"
            disabled={saving}
            onClick={() => removeNote(stop.id)}
          >
            Remove note
          </button>
        </li>
      );
    }

    return (
      <li
        key={stop.id}
        className={`flex flex-col gap-3 rounded-xl border bg-canvas p-3 ${selectedStopId === stop.stopId ? "border-accent" : "border-line"}`}
      >
        <div className="flex items-start justify-between gap-3 text-sm">
          <h3 className="min-w-0 truncate font-medium">{stop.originalName}</h3>
          <span className="shrink-0 text-ink-muted">
            {located ? "Located" : "Needs placement"}
          </span>
        </div>
        {previews[stop.id] ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img
            src={previews[stop.id]}
            alt=""
            loading="lazy"
            decoding="async"
            className="max-h-40 w-full rounded-lg object-cover"
          />
        ) : (
          <p className="rounded-lg bg-wash p-4 text-sm text-ink-muted">
            HEIC preview unavailable; metadata and the original file are retained.
          </p>
        )}
        {stop.capturedAt && (
          <p className="text-xs text-ink-muted">
            Captured <time dateTime={stop.capturedAt}>{new Date(stop.capturedAt).toLocaleString()}</time>
          </p>
        )}
        {located && (
          <p className="text-xs text-ink-muted">
            {stop.lat!.toFixed(5)}, {stop.lng!.toFixed(5)}
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Photo description (required)
          <input
            value={stop.altText}
            maxLength={300}
            disabled={saving}
            className={inputClass}
            aria-label={`Photo description (required): ${stop.originalName}`}
            aria-invalid={Boolean(errors[`alt-${stop.id}`])}
            aria-errormessage={
              errors[`alt-${stop.id}`] ? `alt-error-${stop.id}` : undefined
            }
            onChange={(event) => updatePhoto(stop.id, { altText: event.target.value })}
          />
          {errors[`alt-${stop.id}`] && (
            <span id={`alt-error-${stop.id}`} className="text-accent-text">
              {errors[`alt-${stop.id}`]}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Caption (optional)
          <input
            value={stop.caption}
            maxLength={2000}
            disabled={saving}
            className={inputClass}
            aria-label={`Caption (optional): ${stop.originalName}`}
            aria-invalid={Boolean(errors[`caption-${stop.id}`])}
            aria-errormessage={
              errors[`caption-${stop.id}`] ? `caption-error-${stop.id}` : undefined
            }
            onChange={(event) => updatePhoto(stop.id, { caption: event.target.value })}
          />
          {errors[`caption-${stop.id}`] && (
            <span id={`caption-error-${stop.id}`} className="text-accent-text">
              {errors[`caption-${stop.id}`]}
            </span>
          )}
        </label>
        {errors[`location-${stop.stopId}`] && (
          <p role="alert" className="text-sm text-accent-text">
            {errors[`location-${stop.stopId}`]}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>{uploadLabel(stop.upload)}</span>
          {stop.upload.error && <span className="text-accent-text">{stop.upload.error}</span>}
        </div>
        {stop.upload.status === "uploading" && (
          <progress
            max={100}
            value={stop.upload.progress}
            aria-label={`Upload progress for ${stop.originalName}`}
            className="w-full accent-accent"
          />
        )}
        {placementControls(stop.stopId, located, stop.originalName)}
        {photoRemovalBlocked ? (
          <p className="text-xs text-ink-muted">
            Photo removal is disabled while this draft may belong to a saved walk.
          </p>
        ) : (
          <button
            type="button"
            aria-label={`Remove ${stop.originalName}`}
            className="min-h-11 self-start text-sm text-ink-muted underline underline-offset-4 hover:text-ink disabled:opacity-50"
            disabled={saving || Boolean(removingPhotoId)}
            onClick={() => void removePhoto(stop)}
          >
            {removingPhotoId === stop.id ? "Removing…" : "Remove"}
          </button>
        )}
      </li>
    );
  }

  const showImportQueue =
    importing || draft.photos.some(({ status }) => status === "error");
  const photoRemovalBlocked =
    Boolean(existingWalkId) || confirmationPending;

  return (
    <div className="flex flex-col gap-6 p-4">
      <Link
        href="/dashboard"
        className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
      >
        ← All walks
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">New walk</h1>
        <p className="text-sm text-ink-muted">
          Your photos and edits stay in this browser until the walk is saved.
        </p>
      </header>

      <div aria-live="polite" className="text-sm">
        {draftNotice && <p>{draftNotice}</p>}
        {storageError && (
          <p role="alert" className="text-accent-text">
            {storageError}
          </p>
        )}
      </div>

      {existingWalkId && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-wash p-3 text-sm">
          <Link href={`/dashboard/walks/${existingWalkId}`} className={button}>
            Open saved walk
          </Link>
          <button
            type="button"
            className={button}
            disabled={saving}
            onClick={startWithoutBrowserRecovery}
          >
            Start a new walk without browser recovery
          </button>
        </div>
      )}

      <section aria-label="Placement" className="flex flex-col gap-3">
        <h2 className="font-medium">Place stops on the map</h2>
        <p className="text-sm text-ink-muted">
          Select a photo or note, then click the map. Keyboard users can place it at the map center.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            disabled={saving || Boolean(removingPhotoId) || !selectedStopId}
            onClick={() => {
              if (!requestCenterPoint()) {
                setPlacementMessage("The map is still loading. Try again in a moment.");
              }
            }}
          >
            Place selected at map center
          </button>
          <span className="self-center text-sm text-ink-muted">
            {selectedName ? `Selected: ${selectedName}` : "No stop selected"}
          </span>
        </div>
        <p className="text-sm" aria-live="polite">
          {placementMessage}
        </p>
        <p className="text-sm text-ink-muted">
          {placedStops.length} placed · {unplacedStops.length} unplaced · {formatDistance(distanceM)} route
        </p>
      </section>

      <section aria-label="Photos" className="flex flex-col gap-3">
        <h2 className="font-medium">Photos</h2>
        <MediaCapture
          onPhotos={onPhotos}
          showAudio={false}
          disabled={saving || importing || Boolean(removingPhotoId)}
        />
        {draft.photos.length > 0 && (
          <p className="text-sm" aria-live="polite">
            {draft.photos.filter(({ status }) => status !== "parsing").length} of {draft.photos.length} photos processed
          </p>
        )}
        {showImportQueue && (
          <ul aria-label="Import queue" className="flex flex-col gap-2">
            {draft.photos.map((photo) => (
              <li
                key={photo.id}
                data-status={photo.status}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas p-3 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{photo.originalName}</span>
                <span className="text-ink-muted">
                  {photo.status === "parsing"
                    ? "Reading metadata…"
                    : photo.status === "error"
                      ? "Failed"
                      : hasLocation(photo)
                        ? "Located"
                        : "Needs placement"}
                </span>
                {photo.error && (
                  <p role="alert" className="basis-full break-words text-accent-text">
                    {photo.error}
                  </p>
                )}
                {photo.status === "error" && (
                  <button
                    type="button"
                    aria-label={`Remove ${photo.originalName}`}
                    className="min-h-11 text-ink-muted underline underline-offset-4 hover:text-ink"
                    disabled={Boolean(removingPhotoId)}
                    onClick={() => void removePhoto(photo)}
                  >
                    {removingPhotoId === photo.id ? "Removing…" : "Remove"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {errors.import && (
          <p
            id="import-error"
            role="alert"
            tabIndex={-1}
            className="text-sm text-accent-text"
          >
            {errors.import}
          </p>
        )}
      </section>

      <section aria-label="Unplaced" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Unplaced ({unplacedStops.length})</h2>
          <button
            type="button"
            className={button}
            disabled={saving || Boolean(removingPhotoId)}
            onClick={addNote}
          >
            Add note-only stop
          </button>
        </div>
        {unplacedStops.length === 0 ? (
          <p className="text-sm text-ink-muted">Every stop has a location.</p>
        ) : (
          <ul aria-label="Unplaced tray" className="flex flex-col gap-3">
            {unplacedStops.map(renderStop)}
          </ul>
        )}
      </section>

      {placedStops.length > 0 && (
        <section aria-label="Placed stops" className="flex flex-col gap-3">
          <h2 className="font-medium">Placed stops</h2>
          <ol className="flex flex-col gap-3">{placedStops.map(renderStop)}</ol>
        </section>
      )}

      <section aria-label="Walk details" className="flex flex-col gap-3">
        <h2 className="font-medium">Details</h2>
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            value={draft.title}
            maxLength={120}
            disabled={saving}
            className={inputClass}
            aria-invalid={Boolean(errors.title)}
            aria-errormessage={errors.title ? "title-error" : undefined}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, title: event.target.value }))
            }
          />
          {errors.title && (
            <span id="title-error" className="text-accent-text">
              {errors.title}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Region (optional)
          <input
            value={draft.region}
            maxLength={80}
            disabled={saving}
            placeholder="e.g. Kyoto"
            className={inputClass}
            aria-invalid={Boolean(errors.region)}
            aria-errormessage={errors.region ? "region-error" : undefined}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, region: event.target.value }))
            }
          />
          {errors.region && (
            <span id="region-error" className="text-accent-text">
              {errors.region}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <textarea
            value={draft.description}
            rows={3}
            maxLength={2000}
            disabled={saving}
            className={inputClass}
            aria-invalid={Boolean(errors.description)}
            aria-errormessage={errors.description ? "description-error" : undefined}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, description: event.target.value }))
            }
          />
          {errors.description && (
            <span id="description-error" className="text-accent-text">
              {errors.description}
            </span>
          )}
        </label>
        <fieldset className="flex flex-wrap gap-2" disabled={saving}>
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
                draft.visibility === value
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line hover:bg-wash"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                checked={draft.visibility === value}
                className="sr-only"
                onChange={() =>
                  updateDraft((current) => ({ ...current, visibility: value }))
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      {readyPhotos.length > 0 && (saving || readyPhotos.some(({ upload }) => upload.status !== "pending")) && (
        <div className="flex flex-col gap-1 text-sm" aria-live="polite">
          <span>
            {uploadedCount} of {readyPhotos.length} photos uploaded
          </span>
          <progress
            max={readyPhotos.length}
            value={uploadedCount}
            aria-label="Overall photo upload progress"
            className="w-full accent-accent"
          />
        </div>
      )}

      <div aria-live="polite">
        {saveMessage && (
          <p role="alert" className="rounded-lg bg-wash px-3 py-2 text-sm">
            {saveMessage}
          </p>
        )}
      </div>

      <button
        type="button"
        className={primaryButton}
        disabled={saving || importing || Boolean(removingPhotoId)}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save walk"}
      </button>
    </div>
  );
}

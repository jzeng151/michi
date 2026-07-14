import { sortPhotoImports } from "./photo-import";

export const WALK_DRAFT_VERSION = 1;

export type DraftUpload = {
  status: "pending" | "uploading" | "uploaded" | "error";
  progress: number;
  error: string | null;
  attempted: boolean;
};

export type DraftPhoto = {
  id: string;
  stopId: string;
  file: File;
  originalName: string;
  mime: string | null;
  originalIndex: number;
  status: "parsing" | "ready" | "error";
  error: string | null;
  capturedAt: string | null;
  lat: number | null;
  lng: number | null;
  orientation: number | null;
  altText: string;
  caption: string;
  upload: DraftUpload;
};

export type DraftNote = {
  id: string;
  originalIndex: number;
  text: string;
  lat: number | null;
  lng: number | null;
};

export type WalkDraft = {
  version: typeof WALK_DRAFT_VERSION;
  ownerId: string;
  id: string;
  nextIndex: number;
  title: string;
  region: string;
  description: string;
  visibility: "public" | "private";
  photos: DraftPhoto[];
  notes: DraftNote[];
};

export type OrderedDraftStop =
  | ({ kind: "photo" } & DraftPhoto)
  | ({ kind: "note"; capturedAt: null } & DraftNote);

export function newWalkDraft(ownerId: string): WalkDraft {
  return {
    version: WALK_DRAFT_VERSION,
    ownerId,
    id: crypto.randomUUID(),
    nextIndex: 0,
    title: "",
    region: "",
    description: "",
    visibility: "private",
    photos: [],
    notes: [],
  };
}

export function isValidCoordinate(lng: unknown, lat: unknown): boolean {
  return (
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90
  );
}

export function orderDraftStops(draft: WalkDraft): OrderedDraftStop[] {
  return sortPhotoImports([
    ...draft.photos
      .filter(({ status }) => status === "ready")
      .map((photo) => ({ ...photo, kind: "photo" as const })),
    ...draft.notes.map((note) => ({
      ...note,
      kind: "note" as const,
      capturedAt: null,
    })),
  ]);
}

/** Uploaded items are already retry-safe at their deterministic storage path. */
export function photosToUpload(photos: readonly DraftPhoto[]): DraftPhoto[] {
  return photos.filter(
    ({ status, upload }) => status === "ready" && upload.status !== "uploaded",
  );
}

type DraftBackend = {
  get(ownerId: string): Promise<unknown>;
  put(draft: WalkDraft): Promise<void>;
  delete(ownerId: string): Promise<void>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function restoredDraft(value: unknown, ownerId: string): WalkDraft | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== WALK_DRAFT_VERSION ||
    !("ownerId" in value) ||
    value.ownerId !== ownerId ||
    !("photos" in value) ||
    !Array.isArray(value.photos) ||
    !("notes" in value) ||
    !Array.isArray(value.notes)
  ) {
    throw new Error("The saved draft has an unsupported format.");
  }

  const draft = value as WalkDraft;
  const ids = [
    draft.id,
    ...draft.photos.flatMap(({ id, stopId }) => [id, stopId]),
    ...draft.notes.map(({ id }) => id),
  ];
  if (ids.some((id) => typeof id !== "string" || !UUID.test(id))) {
    throw new Error("The saved draft contains an invalid identifier.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("The saved draft contains duplicate identifiers.");
  }
  const indexes = [
    ...draft.photos.map(({ originalIndex }) => originalIndex),
    ...draft.notes.map(({ originalIndex }) => originalIndex),
  ];
  if (
    indexes.some((index) => !Number.isInteger(index) || index < 0) ||
    new Set(indexes).size !== indexes.length
  ) {
    throw new Error("The saved draft contains invalid stop ordering.");
  }
  if (
    draft.photos.some(
      ({ file, lat, lng }) =>
        !(file instanceof Blob) ||
        ((lat !== null || lng !== null) && !isValidCoordinate(lng, lat)),
    ) ||
    draft.notes.some(
      ({ lat, lng }) =>
        (lat !== null || lng !== null) && !isValidCoordinate(lng, lat),
    )
  ) {
    throw new Error("The saved draft contains invalid photo or location data.");
  }
  return {
    ...draft,
    photos: draft.photos.map((photo) => ({
      ...photo,
      upload:
        photo.upload.status === "uploading"
          ? {
              status: "error",
              progress: 0,
              error: "Upload was interrupted; retry safely.",
              attempted: true,
            }
          : {
              ...photo.upload,
              attempted:
                photo.upload.attempted ?? photo.upload.status !== "pending",
            },
    })),
  };
}

export function createDraftRepository(backend: DraftBackend) {
  return {
    async restore(ownerId: string) {
      return restoredDraft(await backend.get(ownerId), ownerId);
    },
    save(draft: WalkDraft) {
      return backend.put(draft);
    },
    clear(ownerId: string) {
      return backend.delete(ownerId);
    },
  };
}

const DATABASE = "michi";
const STORE = "walk-drafts";
const FILE_STORE = "walk-draft-files";
const FILE_OWNER_INDEX = "ownerId";
let database: Promise<IDBDatabase> | null = null;
const storedFileIds = new Map<string, Set<string>>();

type StoredFile = {
  key: string;
  ownerId: string;
  photoId: string;
  file: File;
};

function fileKey(ownerId: string, photoId: string) {
  return `${ownerId}/${photoId}`;
}

function withoutFile(photo: DraftPhoto): Omit<DraftPhoto, "file"> {
  const metadata = { ...photo };
  delete (metadata as Partial<DraftPhoto>).file;
  return metadata;
}

function attachFiles(value: unknown, files: StoredFile[]): unknown {
  if (
    typeof value !== "object" ||
    value === null ||
    !("photos" in value) ||
    !Array.isArray(value.photos)
  ) {
    return value;
  }
  const byId = new Map(files.map(({ photoId, file }) => [photoId, file]));
  return {
    ...value,
    photos: value.photos.map((photo: unknown) => {
      if (typeof photo !== "object" || photo === null || !("id" in photo)) {
        return photo;
      }
      if ("file" in photo && photo.file instanceof Blob) return photo;
      return { ...photo, file: byId.get(String(photo.id)) };
    }),
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "ownerId" });
      }
      if (!request.result.objectStoreNames.contains(FILE_STORE)) {
        request.result
          .createObjectStore(FILE_STORE, { keyPath: "key" })
          .createIndex(FILE_OWNER_INDEX, "ownerId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function browserDraftRepository() {
  return {
    async restore(ownerId: string) {
      const db = await openDatabase();
      const transaction = db.transaction([STORE, FILE_STORE], "readonly");
      const done = transactionDone(transaction);
      const [value, files] = await Promise.all([
        requestResult(transaction.objectStore(STORE).get(ownerId)),
        requestResult<StoredFile[]>(
          transaction
            .objectStore(FILE_STORE)
            .index(FILE_OWNER_INDEX)
            .getAll(ownerId),
        ),
      ]);
      await done;
      storedFileIds.set(ownerId, new Set(files.map(({ photoId }) => photoId)));
      return restoredDraft(attachFiles(value, files), ownerId);
    },
    async save(draft: WalkDraft) {
      const db = await openDatabase();
      const transaction = db.transaction([STORE, FILE_STORE], "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(STORE).put({
        ...draft,
        photos: draft.photos.map(withoutFile),
      });
      const fileStore = transaction.objectStore(FILE_STORE);
      const previous = storedFileIds.get(draft.ownerId) ?? new Set<string>();
      const current = new Set(draft.photos.map(({ id }) => id));
      for (const photo of draft.photos) {
        if (!previous.has(photo.id)) {
          fileStore.put({
            key: fileKey(draft.ownerId, photo.id),
            ownerId: draft.ownerId,
            photoId: photo.id,
            file: photo.file,
          } satisfies StoredFile);
        }
      }
      for (const photoId of previous) {
        if (!current.has(photoId)) {
          fileStore.delete(fileKey(draft.ownerId, photoId));
        }
      }
      await done;
      storedFileIds.set(draft.ownerId, current);
    },
    async clear(ownerId: string) {
      const db = await openDatabase();
      const transaction = db.transaction([STORE, FILE_STORE], "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(STORE).delete(ownerId);
      const fileStore = transaction.objectStore(FILE_STORE);
      const cursor = fileStore
        .index(FILE_OWNER_INDEX)
        .openKeyCursor(IDBKeyRange.only(ownerId));
      cursor.onsuccess = () => {
        if (!cursor.result) return;
        fileStore.delete(cursor.result.primaryKey);
        cursor.result.continue();
      };
      await done;
      storedFileIds.delete(ownerId);
    },
  };
}

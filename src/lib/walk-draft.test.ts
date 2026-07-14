import { describe, expect, it } from "vitest";
import {
  createDraftRepository,
  isValidCoordinate,
  orderDraftStops,
  photosToUpload,
  type WalkDraft,
} from "./walk-draft";

const ownerId = "00000000-0000-4000-8000-000000000001";
const draftId = "10000000-0000-4000-8000-000000000001";

const photo = (
  id: string,
  stopId: string,
  name: string,
  originalIndex: number,
  capturedAt: string | null,
) => ({
  id,
  stopId,
  file: new File([name], `${name}.jpg`, { type: "image/jpeg" }),
  originalName: name,
  mime: "image/jpeg",
  originalIndex,
  status: "ready" as const,
  error: null,
  capturedAt,
  lat: null,
  lng: null,
  orientation: null,
  altText: name,
  caption: "",
  upload: {
    status: "pending" as const,
    progress: 0,
    error: null,
    attempted: false,
  },
});

function draft(): WalkDraft {
  return {
    version: 1,
    ownerId,
    id: draftId,
    nextIndex: 4,
    title: "Draft",
    region: "",
    description: "",
    visibility: "private",
    photos: [
      photo(
        "30000000-0000-4000-8000-000000000001",
        "40000000-0000-4000-8000-000000000001",
        "untimed",
        0,
        null,
      ),
      photo(
        "30000000-0000-4000-8000-000000000002",
        "40000000-0000-4000-8000-000000000002",
        "later",
        1,
        "2026-01-02T00:00:00Z",
      ),
      photo(
        "30000000-0000-4000-8000-000000000003",
        "40000000-0000-4000-8000-000000000003",
        "earlier",
        2,
        "2026-01-01T00:00:00Z",
      ),
    ],
    notes: [
      {
        id: "40000000-0000-4000-8000-000000000004",
        originalIndex: 3,
        text: "A note",
        lat: null,
        lng: null,
      },
    ],
  };
}

describe("walk drafts", () => {
  it("validates complete geographic coordinates", () => {
    expect(isValidCoordinate(180, 90)).toBe(true);
    expect(isValidCoordinate(-180, -90)).toBe(true);
    expect(isValidCoordinate(181, 0)).toBe(false);
    expect(isValidCoordinate(0, Number.NaN)).toBe(false);
    expect(isValidCoordinate(null, 35)).toBe(false);
  });

  it("orders timed stops first and untimed stops deterministically", () => {
    expect(
      orderDraftStops(draft()).map((stop) =>
        stop.kind === "photo" ? stop.originalName : stop.text,
      ),
    ).toEqual([
      "earlier",
      "later",
      "untimed",
      "A note",
    ]);
  });

  it("restores and clears a draft while resetting interrupted uploads", async () => {
    const rows = new Map<string, WalkDraft>();
    const repository = createDraftRepository({
      get: async (ownerId) => rows.get(ownerId),
      put: async (value) => void rows.set(value.ownerId, value),
      delete: async (ownerId) => void rows.delete(ownerId),
    });
    const value = draft();
    value.photos[0].upload.status = "uploading";

    await repository.save(value);
    expect((await repository.restore(ownerId))?.photos[0].upload).toMatchObject({
      status: "error",
      attempted: true,
    });
    await repository.clear(ownerId);
    expect(await repository.restore(ownerId)).toBeNull();
  });

  it("rejects a damaged draft before it can reach storage sync", async () => {
    const value = draft();
    value.id = "not-a-uuid";
    const repository = createDraftRepository({
      get: async () => value,
      put: async () => undefined,
      delete: async () => undefined,
    });

    await expect(repository.restore(ownerId)).rejects.toThrow(
      "invalid identifier",
    );
  });

  it("retries pending and failed files without reuploading successful files", () => {
    const photos = draft().photos;
    photos[1].upload.status = "error";
    photos[2].upload.status = "uploaded";

    expect(photosToUpload(photos).map(({ originalName }) => originalName)).toEqual([
      "untimed",
      "later",
    ]);
  });
});

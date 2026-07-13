import { expect, it } from "vitest";
import type { DraftPhoto, DraftUpload } from "./walk-draft";
import { uploadDraftPhotos } from "./walk-save";

it("bounds uploads and keeps each file's retry state", async () => {
  const photos = ["one", "two", "three"].map(
    (id): DraftPhoto => ({
      id,
      stopId: `${id}-stop`,
      file: new File([id], `${id}.jpg`, { type: "image/jpeg" }),
      originalName: `${id}.jpg`,
      mime: "image/jpeg",
      originalIndex: 0,
      status: "ready",
      error: null,
      capturedAt: null,
      lat: null,
      lng: null,
      orientation: null,
      altText: id,
      caption: "",
      upload: { status: "pending", progress: 0, error: null, attempted: false },
    }),
  );
  const states = new Map<string, DraftUpload>();
  let active = 0;
  let maxActive = 0;
  const results = await uploadDraftPhotos(
    photos,
    ({ id }) => `owner/draft/${id}.jpg`,
    "token",
    (id, state) => states.set(id, state),
    async ({ id }, _path, _token, onProgress) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      onProgress(50);
      await Promise.resolve();
      active -= 1;
      if (id === "two") throw new Error("Forced failure");
    },
    2,
  );

  expect(maxActive).toBe(2);
  expect(results.find(({ id }) => id === "two")?.error).toBe("Forced failure");
  expect(states.get("one")?.status).toBe("uploaded");
  expect(states.get("two")).toMatchObject({
    status: "error",
    error: "Forced failure",
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizePhotoMetadata,
  parsePhotoBatch,
  photoMime,
  readPhotoMetadata,
  sortPhotoImports,
  type PhotoMetadata,
} from "./photo-import";

const emptyMetadata: PhotoMetadata = {
  capturedAt: null,
  lat: null,
  lng: null,
  orientation: null,
};

// 1px derivative of exifr's MIT-licensed heic-iphone.heic fixture. Its
// DateTimeDigitized tag is replaced with a synthetic +07:00 offset.
const HEIC_WITH_METADATA =
  "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";

class BlobFileReader {
  error: unknown = null;
  onerror: (() => void) | null = null;
  onload: ((event: { target: { result: ArrayBuffer } }) => void) | null = null;

  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then(
      (result) => this.onload?.({ target: { result } }),
      (error) => {
        this.error = error;
        this.onerror?.();
      },
    );
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("photo metadata normalization", () => {
  it.each([
    ["north/east", 35, 135, 35, 135],
    ["south", -35, 135, -35, 135],
    ["west", 35, -135, 35, -135],
    ["south/west", -35, -135, -35, -135],
  ])("keeps signed %s coordinates", (_, latitude, longitude, lat, lng) => {
    expect(normalizePhotoMetadata({ latitude, longitude })).toMatchObject({
      lat,
      lng,
    });
  });

  it.each([
    ["+09:00", "2024-07-13T00:30:00.250Z"],
    ["-04:30", "2024-07-13T14:00:00.250Z"],
  ])("normalizes capture time with offset %s", (offset, expected) => {
    expect(
      normalizePhotoMetadata({
        dateTimeOriginal: "2024:07:13 09:30:00",
        offsetTimeOriginal: offset,
        subSecTimeOriginal: "250",
      }).capturedAt,
    ).toBe(expected);
  });

  it("drops incomplete coordinates, invalid times, and invalid orientations", () => {
    expect(normalizePhotoMetadata({})).toEqual(emptyMetadata);
    expect(
      normalizePhotoMetadata({
        dateTimeOriginal: "2024:07:13 09:30:00",
      }),
    ).toEqual(emptyMetadata);
    expect(
      normalizePhotoMetadata({
        dateTimeOriginal: "2024:07:13 09:30:00",
        offsetTimeOriginal: "+25:00",
      }),
    ).toEqual(emptyMetadata);
    expect(
      normalizePhotoMetadata({
        latitude: 35,
        dateTimeOriginal: "2024:02:31 09:30:00",
        orientation: 9,
      }),
    ).toEqual(emptyMetadata);
    expect(normalizePhotoMetadata({ orientation: 8 }).orientation).toBe(8);
  });
});

describe("photo import queue", () => {
  it("reads real HEIC metadata from a Japanese-named file", async () => {
    vi.stubGlobal("FileReader", BlobFileReader);
    const bytes = Uint8Array.from(Buffer.from(HEIC_WITH_METADATA, "base64"));
    const file = new File([bytes], "京都の散歩.heic", { type: "" });

    expect(photoMime(file)).toBe("image/heic");
    expect(await readPhotoMetadata(file)).toEqual({
      capturedAt: "2019-08-21T03:57:23.345Z",
      lat: 7.8314305555555555,
      lng: 98.29665277777778,
      orientation: 1,
    });
  });

  it("isolates corrupt metadata and unsupported files", async () => {
    const files = [
      new File(["broken"], "broken.jpg", { type: "image/jpeg" }),
      new File(["notes"], "notes.txt", { type: "text/plain" }),
    ];
    let reads = 0;

    const results = await parsePhotoBatch(files, 0, () => {}, async () => {
      reads += 1;
      throw new Error("Invalid image format");
    });

    expect(reads).toBe(1);
    expect(results).toHaveLength(2);
    expect(results.map(({ status }) => status)).toEqual(["error", "error"]);
    expect(results[0].error).toContain("Invalid image format");
    expect(results[1].error).toBe("Unsupported image type.");
  });

  it("sorts timed photos first with original order as the tie-break", () => {
    const items = [
      { id: "untimed-first", capturedAt: null, originalIndex: 0 },
      { id: "same-first", capturedAt: "2024-01-02T00:00:00Z", originalIndex: 1 },
      { id: "earlier", capturedAt: "2024-01-01T00:00:00Z", originalIndex: 2 },
      { id: "same-second", capturedAt: "2024-01-02T00:00:00Z", originalIndex: 3 },
      { id: "untimed-second", capturedAt: null, originalIndex: 4 },
    ];

    expect(sortPhotoImports(items).map(({ id }) => id)).toEqual([
      "earlier",
      "same-first",
      "same-second",
      "untimed-first",
      "untimed-second",
    ]);
  });

  it("bounds concurrent reads and orders a mixed 20-photo batch", async () => {
    const mixed = Array.from({ length: 10 }, (_, index) => [19 - index, index]).flat();
    const files = mixed.map(
      (number) =>
        new File([String(number)], `photo-${String(number).padStart(2, "0")}.jpg`, {
          type: "image/jpeg",
        }),
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0;
    let maxActive = 0;

    const parsing = parsePhotoBatch(
      files,
      0,
      () => {},
      async (file) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gate;
        active -= 1;
        const day = Number(file.name.slice(6, 8)) + 1;
        return {
          ...emptyMetadata,
          capturedAt: `2024-01-${String(day).padStart(2, "0")}T00:00:00.000Z`,
        };
      },
    );

    expect(maxActive).toBe(4);
    release();
    const results = await parsing;

    expect(maxActive).toBe(4);
    expect(results).toHaveLength(20);
    expect(results.map(({ file }) => file.name)).toEqual(
      Array.from(
        { length: 20 },
        (_, number) => `photo-${String(number).padStart(2, "0")}.jpg`,
      ),
    );
  });
});

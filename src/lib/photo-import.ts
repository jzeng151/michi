import ExifReader from "exifreader";

export const PHOTO_IMPORT_CONCURRENCY = 4;
export const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export type PhotoMetadata = {
  capturedAt: string | null;
  lat: number | null;
  lng: number | null;
  orientation: number | null;
};

export type RawPhotoMetadata = {
  dateTimeOriginal?: string | null;
  offsetTimeOriginal?: string | null;
  subSecTimeOriginal?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  orientation?: number | null;
};

export type PhotoImportResult = PhotoMetadata & {
  file: File;
  mime: string | null;
  originalIndex: number;
  status: "ready" | "error";
  error: string | null;
};

export type PhotoMetadataReader = (file: File) => Promise<PhotoMetadata>;

const MIME_BY_EXTENSION: Record<string, string> = {
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const SUPPORTED_MIMES = new Set(Object.values(MIME_BY_EXTENSION));

export function photoMime(file: File): string | null {
  const declared = file.type.toLowerCase().split(";", 1)[0];
  if (declared === "image/jpg") return "image/jpeg";
  if (SUPPORTED_MIMES.has(declared)) return declared;
  if (declared && declared !== "application/octet-stream") return null;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? (MIME_BY_EXTENSION[extension] ?? null) : null;
}

export function hasBrowserPreview(mime: string | null): boolean {
  return mime !== null && mime !== "image/heic" && mime !== "image/heif";
}

function captureTime(
  value: string | null | undefined,
  offset: string | null | undefined,
  subSeconds: string | null | undefined,
): string | null {
  const match = value
    ?.trim()
    .match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match.map(Number);
  const milliseconds = Number(`0.${subSeconds?.replace(/\D/g, "") || 0}`) * 1000;
  const wallTime = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    milliseconds,
  );
  const wallDate = new Date(wallTime);
  if (
    wallDate.getUTCFullYear() !== year ||
    wallDate.getUTCMonth() !== month - 1 ||
    wallDate.getUTCDate() !== day ||
    wallDate.getUTCHours() !== hour ||
    wallDate.getUTCMinutes() !== minute ||
    wallDate.getUTCSeconds() !== second
  ) {
    return null;
  }

  const offsetMatch = offset
    ?.trim()
    .match(/^([+-])((?:[01]\d|2[0-3])):?([0-5]\d)$/);
  if (!offsetMatch) return null;
  const offsetMinutes =
    (offsetMatch[1] === "+" ? 1 : -1) *
    (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
  return new Date(wallTime - offsetMinutes * 60_000).toISOString();
}

export function normalizePhotoMetadata(raw: RawPhotoMetadata): PhotoMetadata {
  const lat =
    Number.isFinite(raw.latitude) && Math.abs(raw.latitude!) <= 90
      ? raw.latitude!
      : null;
  const lng =
    Number.isFinite(raw.longitude) && Math.abs(raw.longitude!) <= 180
      ? raw.longitude!
      : null;
  const orientation =
    Number.isInteger(raw.orientation) &&
    raw.orientation! >= 1 &&
    raw.orientation! <= 8
      ? raw.orientation!
      : null;

  return {
    capturedAt: captureTime(
      raw.dateTimeOriginal,
      raw.offsetTimeOriginal,
      raw.subSecTimeOriginal,
    ),
    lat: lat !== null && lng !== null ? lat : null,
    lng: lat !== null && lng !== null ? lng : null,
    orientation,
  };
}

function first(value: string[] | undefined): string | null {
  return value?.[0] ?? null;
}

export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  try {
    const tags = await ExifReader.load(file, {
      length: "auto",
      expanded: true,
      includeOffsets: true,
      includeTags: {
        exif: [
          "DateTimeOriginal",
          "SubSecTimeOriginal",
          "OffsetTimeOriginal",
          "OffsetTime",
          "Orientation",
          "GPSLatitude",
          "GPSLatitudeRef",
          "GPSLongitude",
          "GPSLongitudeRef",
        ],
        gps: true,
      },
    });

    return normalizePhotoMetadata({
      dateTimeOriginal: first(tags.exif?.DateTimeOriginal?.value),
      offsetTimeOriginal:
        first(tags.exif?.OffsetTimeOriginal?.value) ??
        first(tags.exif?.OffsetTime?.value),
      subSecTimeOriginal: first(tags.exif?.SubSecTimeOriginal?.value),
      latitude: tags.gps?.Latitude,
      longitude: tags.gps?.Longitude,
      orientation: tags.exif?.Orientation?.value,
    });
  } catch (error) {
    if (error instanceof ExifReader.errors.MetadataMissingError) {
      return normalizePhotoMetadata({});
    }
    throw error;
  }
}

export function sortPhotoImports<
  T extends { capturedAt: string | null; originalIndex: number },
>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.capturedAt && b.capturedAt) {
      const byTime = Date.parse(a.capturedAt) - Date.parse(b.capturedAt);
      if (byTime !== 0) return byTime;
    } else if (a.capturedAt) {
      return -1;
    } else if (b.capturedAt) {
      return 1;
    }
    return a.originalIndex - b.originalIndex;
  });
}

export async function parsePhotoBatch(
  files: readonly File[],
  startIndex: number,
  onResult: (result: PhotoImportResult) => void,
  readMetadata: PhotoMetadataReader = readPhotoMetadata,
  concurrency = PHOTO_IMPORT_CONCURRENCY,
): Promise<PhotoImportResult[]> {
  const results: PhotoImportResult[] = [];
  let cursor = 0;

  async function parseNext() {
    while (cursor < files.length) {
      const position = cursor++;
      const file = files[position];
      const originalIndex = startIndex + position;
      const mime = photoMime(file);
      let result: PhotoImportResult;

      if (!mime) {
        result = {
          file,
          mime: null,
          originalIndex,
          status: "error",
          error: "Unsupported image type.",
          ...normalizePhotoMetadata({}),
        };
      } else {
        try {
          result = {
            file,
            mime,
            originalIndex,
            status: "ready",
            error: null,
            ...(await readMetadata(file)),
          };
        } catch (error) {
          const detail = error instanceof Error ? `: ${error.message}` : "";
          result = {
            file,
            mime,
            originalIndex,
            status: "error",
            error: `Couldn’t read metadata${detail}`,
            ...normalizePhotoMetadata({}),
          };
        }
      }

      results[position] = result;
      onResult(result);
    }
  }

  const workerCount = Math.min(
    files.length,
    Math.max(1, Math.floor(concurrency)),
  );
  await Promise.all(Array.from({ length: workerCount }, parseNext));
  return sortPhotoImports(results);
}

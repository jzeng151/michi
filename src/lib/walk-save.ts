import type { DraftPhoto, DraftUpload } from "./walk-draft";

type UploadFile = (
  photo: DraftPhoto,
  storagePath: string,
  accessToken: string,
  onProgress: (progress: number) => void,
) => Promise<void>;

export type UploadResult = {
  id: string;
  storagePath: string;
  error: string | null;
};

function storageUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Photo storage is not configured.");
  const path = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/walk-media/${path}`;
}

export const uploadFile: UploadFile = (
  photo,
  storagePath,
  accessToken,
  onProgress,
) =>
  new Promise((resolve, reject) => {
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!apiKey) {
      reject(new Error("Photo storage is not configured."));
      return;
    }

    const request = new XMLHttpRequest();
    request.open("POST", storageUrl(storagePath));
    request.timeout = 60_000;
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("apikey", apiKey);
    request.setRequestHeader("Content-Type", photo.mime ?? "application/octet-stream");
    request.setRequestHeader("x-upsert", "true");
    request.upload.onprogress = ({ lengthComputable, loaded, total }) => {
      if (lengthComputable && total > 0) {
        onProgress(Math.min(99, Math.round((loaded / total) * 100)));
      }
    };
    request.onerror = () => reject(new Error("Network error while uploading."));
    request.onabort = () => reject(new Error("Upload was cancelled."));
    request.ontimeout = () => reject(new Error("Upload timed out. Try again."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      let detail = request.statusText || `HTTP ${request.status}`;
      try {
        const body = JSON.parse(request.responseText) as {
          message?: string;
          error?: string;
        };
        detail = body.message ?? body.error ?? detail;
      } catch {
        // Keep the HTTP detail when storage did not return JSON.
      }
      reject(new Error(detail));
    };
    request.send(photo.file);
  });

export async function uploadDraftPhotos(
  photos: readonly DraftPhoto[],
  storagePath: (photo: DraftPhoto) => string,
  accessToken: string,
  onChange: (id: string, upload: DraftUpload) => void,
  upload: UploadFile = uploadFile,
  concurrency = 3,
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  let cursor = 0;

  async function next() {
    while (cursor < photos.length) {
      const photo = photos[cursor++];
      const path = storagePath(photo);
      onChange(photo.id, {
        status: "uploading",
        progress: 0,
        error: null,
        attempted: true,
      });
      try {
        await upload(photo, path, accessToken, (progress) =>
          onChange(photo.id, {
            status: "uploading",
            progress,
            error: null,
            attempted: true,
          }),
        );
        onChange(photo.id, {
          status: "uploaded",
          progress: 100,
          error: null,
          attempted: true,
        });
        results.push({ id: photo.id, storagePath: path, error: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        onChange(photo.id, {
          status: "error",
          progress: 0,
          error: message,
          attempted: true,
        });
        results.push({ id: photo.id, storagePath: path, error: message });
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(photos.length, Math.max(1, Math.floor(concurrency))) },
      next,
    ),
  );
  return results;
}

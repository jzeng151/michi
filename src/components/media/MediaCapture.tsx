"use client";

import { useRef, useState } from "react";
import { PHOTO_ACCEPT } from "@/lib/photo-import";

export type CapturedMedia = {
  kind: "photo" | "audio";
  file: Blob;
  originalName: string | null;
  mime: string;
  previewUrl: string;
};

const AUDIO_MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
];

function pickAudioMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return AUDIO_MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export function MediaCapture({
  onPhotos,
  onCapture,
  showAudio = true,
  disabled = false,
}: {
  onPhotos: (files: File[]) => void;
  onCapture?: (media: CapturedMedia) => void;
  showAudio?: boolean;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    pickAudioMime() !== null;

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onPhotos(files);
    e.target.value = ""; // allow re-selecting the same file
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onPhotos(files);
  }

  async function toggleAudio() {
    setAudioError(null);
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mime = pickAudioMime()!;
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        // Store the recorder's actual output type (iOS reports audio/mp4).
        const type = recorder.mimeType.split(";")[0];
        const blob = new Blob(chunks, { type });
        onCapture?.({
          kind: "audio",
          file: blob,
          originalName: null,
          mime: type,
          previewUrl: URL.createObjectURL(blob),
        });
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setAudioError(
        "Microphone unavailable. Check the browser's mic permission and try again.",
      );
    }
  }

  const buttonClass =
    "min-h-11 rounded-full border border-line px-4 py-2 text-sm transition-colors hover:bg-wash disabled:opacity-50";

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-dashed border-line p-4"
      role="group"
      aria-label="Photo import"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <p className="text-sm text-ink-muted">
        Drop photos here or choose them from your camera roll.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          📷 Choose photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          disabled={disabled}
          hidden
          onChange={onPhotoChange}
        />
        {showAudio &&
          onCapture &&
          (audioSupported ? (
            <button
              type="button"
              className={`${buttonClass} ${recording ? "bg-accent text-accent-ink" : ""}`}
              aria-pressed={recording}
              onClick={toggleAudio}
            >
              {recording ? "■ Stop recording" : "🎙 Record audio note"}
            </button>
          ) : (
            <p className="self-center text-sm text-ink-muted">
              Audio notes aren&apos;t supported in this browser.
            </p>
          ))}
      </div>
      {showAudio && onCapture && (
        <div aria-live="polite">
          {recording && (
            <p className="text-sm text-accent-text">Recording audio…</p>
          )}
          {audioError && <p className="text-sm text-accent-text">{audioError}</p>}
        </div>
      )}
    </div>
  );
}

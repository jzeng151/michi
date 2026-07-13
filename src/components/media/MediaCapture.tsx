"use client";

import { useRef, useState } from "react";

export type CapturedMedia = {
  kind: "photo" | "audio";
  file: Blob;
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
  onCapture,
  showAudio = true,
}: {
  onCapture: (media: CapturedMedia) => void;
  showAudio?: boolean;
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
    const file = e.target.files?.[0];
    if (!file) return;
    onCapture({
      kind: "photo",
      file,
      mime: file.type || "image/jpeg",
      previewUrl: URL.createObjectURL(file),
    });
    e.target.value = ""; // allow re-selecting the same file
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
        onCapture({
          kind: "audio",
          file: blob,
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
    "rounded-full border border-line px-4 py-2 text-sm transition-colors hover:bg-wash";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() => fileInputRef.current?.click()}
        >
          📷 Add photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          aria-label="Add photo"
          onChange={onPhotoChange}
        />
        {showAudio &&
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
      {showAudio && (
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

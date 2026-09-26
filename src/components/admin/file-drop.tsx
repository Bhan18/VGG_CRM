"use client";

// Drag-and-drop (or tap-to-browse) file upload. Uploads straight from the
// device to a server upload route — no pasted links. Shows a live preview.

import { useRef, useState } from "react";
import { UploadCloud, Loader2, FileText, X, PlayCircle } from "lucide-react";

export function FileDrop({
  label,
  accept,
  maxMB,
  uploadUrl,
  folder,
  kind,
  value,
  onUploaded,
  onClear,
  onFileSelected,
  hint,
}: {
  label: string;
  accept: string;
  maxMB: number;
  uploadUrl: string;
  folder?: string;
  kind: "image" | "video" | "file";
  value: string | null;
  onUploaded: (url: string, bytes: number) => void;
  onClear?: () => void;
  onFileSelected?: (file: File) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > maxMB * 1024 * 1024) {
      setError(`File must be ${maxMB}MB or smaller.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (folder) form.append("folder", folder);
      const res = await fetch(uploadUrl, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.url) {
        setError(d?.error ?? "Upload failed. Try again.");
        return;
      }
      onUploaded(d.url, d.bytes ?? file.size);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !busy) {
      onFileSelected?.(f);
      void upload(f);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--brand-ink)]/70">{label}</span>

      {value ? (
        <div className="relative overflow-hidden rounded-xl border" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}>
          {kind === "image" ? (
            <img src={value} alt="Upload preview" className="aspect-[16/9] w-full object-cover" />
          ) : kind === "video" ? (
            <video src={value} controls playsInline preload="metadata" className="aspect-video w-full bg-black" />
          ) : (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 bg-white px-3 py-3 text-xs font-medium"
              style={{ color: "var(--brand-emerald)" }}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{fileNameOf(value)}</span>
            </a>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove file"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="agent-press flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors disabled:opacity-70"
          style={{
            borderColor: dragging ? "var(--brand-emerald)" : "color-mix(in srgb, var(--brand-emerald) 25%, #e5e0d4)",
            background: dragging ? "color-mix(in srgb, var(--brand-emerald) 6%, white)" : "color-mix(in srgb, var(--brand-emerald) 2%, white)",
          }}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--brand-emerald)" }} />
          ) : kind === "video" ? (
            <PlayCircle className="h-6 w-6 text-[var(--brand-ink)]/30" />
          ) : (
            <UploadCloud className="h-6 w-6 text-[var(--brand-ink)]/30" />
          )}
          <span className="text-xs font-medium">
            {busy ? "Uploading..." : dragging ? "Drop the file here" : "Drag & drop, or tap to choose"}
          </span>
          <span className="text-[10px] text-[var(--brand-ink)]/45">
            {hint ?? `From this device · up to ${maxMB}MB`}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) {
            onFileSelected?.(f);
            void upload(f);
          }
        }}
      />
      {error && (
        <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

/** Read a local video file's duration (seconds) without uploading. */
export function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        const d = el.duration;
        URL.revokeObjectURL(el.src);
        resolve(Number.isFinite(d) ? Math.round(d) : null);
      };
      el.onerror = () => resolve(null);
      el.src = URL.createObjectURL(file);
      setTimeout(() => resolve(null), 8000);
    } catch {
      resolve(null);
    }
  });
}

function fileNameOf(url: string): string {
  try {
    const name = new URL(url).pathname.split("/").pop() ?? "";
    return decodeURIComponent(name) || "Attached file";
  } catch {
    return "Attached file";
  }
}

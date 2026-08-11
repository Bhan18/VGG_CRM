"use client";

// Camera capture flow.
// Step 1: live camera preview (front camera).
// Step 2: capture -> square center-crop JPEG @ 0.82 quality.
// Step 3: AFTER photo is captured, request GPS once.
// Step 4: call onSubmit with photo + geo reading.
//
// The geofence radius is NEVER shown. The user sees only "Verifying your
// location…" while GPS is being read after the photo.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { readPositionOnce } from "@/lib/agent/geo";
import type { GeoReading } from "@/lib/agent/types";

interface CameraCaptureProps {
  type: "check_in" | "check_out";
  onSubmit: (payload: { photoBase64: string; geo: GeoReading | null }) => Promise<void>;
  onCancel: () => void;
  // If provided, shown as a non-blocking banner when the agent is outside
  // the geofence. The agent can still proceed.
  warnAwayMeters?: number | null;
}

type Stage = "preview" | "captured" | "locating" | "submitting" | "error";

export function CameraCapture({ type, onSubmit, onCancel, warnAwayMeters }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>("preview");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start camera on mount.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera is not available on this device.");
          setStage("error");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        const err = e as DOMException;
        const msg =
          err?.name === "NotAllowedError"
            ? "Camera permission was denied. Enable it in your browser settings."
            : err?.name === "NotFoundError"
              ? "No camera was found on this device."
              : "Could not start the camera. Please try again.";
        setError(msg);
        setStage("error");
      }
    }
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Capture a square frame from the center of the video.
  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 640, 640);
    const url = canvas.toDataURL("image/jpeg", 0.82);
    setPhotoDataUrl(url);
    setStage("captured");
    // Stop the camera — we have the photo.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Retake — restart the camera.
  const retake = useCallback(async () => {
    setPhotoDataUrl(null);
    setStage("preview");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setError("Could not restart the camera.");
      setStage("error");
    }
  }, []);

  // Submit: photo first, THEN read GPS, then call onSubmit.
  const submit = useCallback(async () => {
    if (!photoDataUrl) return;
    setStage("locating");
    let geo: GeoReading | null = null;
    try {
      const pos = await readPositionOnce();
      geo = { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, distanceMeters: null };
    } catch {
      // GPS unavailable — we still submit, but the server will flag.
      geo = null;
    }
    setStage("submitting");
    try {
      await onSubmit({ photoBase64: photoDataUrl, geo });
    } catch (e) {
      setStage("captured");
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Could not submit. Please try again.",
      );
    }
  }, [photoDataUrl, onSubmit]);

  const accent =
    type === "check_in"
      ? "var(--brand-checkin)"
      : "var(--brand-checkout)";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button
          onClick={onCancel}
          className="agent-press flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-sm font-medium">
          {type === "check_in" ? "Check-in" : "Check-out"}
        </div>
        <div className="h-9 w-9" />
      </div>

      {/* Camera viewport / preview / captured photo */}
      <div className="relative flex-1 overflow-hidden">
        {stage === "preview" && (
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}
        {stage !== "preview" && photoDataUrl && (
          <img
            src={photoDataUrl}
            alt="Captured"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {/* Center framing guide */}
        {(stage === "preview" || stage === "captured") && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-2xl border-2 border-dashed"
              style={{
                width: "min(78vw, 360px)",
                height: "min(78vw, 360px)",
                borderColor: "color-mix(in srgb, white 70%, transparent)",
              }}
            />
          </div>
        )}

        {/* Status overlay while locating / submitting */}
        {(stage === "locating" || stage === "submitting") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center text-white">
            {stage === "locating" ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-gold)" }} />
                <div className="text-sm font-medium">Verifying your location…</div>
                <div className="text-xs text-white/60">
                  Hold still — this only takes a moment.
                </div>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-gold)" }} />
                <div className="text-sm font-medium">Submitting…</div>
              </>
            )}
          </div>
        )}

        {stage === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-white">
            <AlertTriangle className="h-8 w-8" style={{ color: "var(--brand-checkout)" }} />
            <div className="text-sm font-medium">Camera error</div>
            <div className="text-xs text-white/70 max-w-xs">{error}</div>
            <button
              onClick={onCancel}
              className="mt-2 rounded-xl bg-white/10 px-4 py-2 text-sm"
            >
              Go back
            </button>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className="flex-shrink-0 px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        {stage === "preview" && (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={capture}
              className="agent-press flex h-18 w-18 items-center justify-center rounded-full border-4 border-white/80"
              style={{ height: "4.5rem", width: "4.5rem" }}
              aria-label="Capture photo"
            >
              <span
                className="h-14 w-14 rounded-full"
                style={{ background: accent }}
              />
            </button>
            <div className="text-xs text-white/60">Center your face in the frame</div>
          </div>
        )}

        {stage === "captured" && (
          <div className="flex flex-col gap-3">
            {warnAwayMeters != null && (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--brand-warn) 18%, transparent)",
                  color: "#fde68a",
                  border: "1px solid color-mix(in srgb, var(--brand-warn) 40%, transparent)",
                }}
              >
                You are {warnAwayMeters < 1000 ? `${Math.round(warnAwayMeters)} m` : `${(warnAwayMeters / 1000).toFixed(2)} km`} away from the office. You can still submit — your attendance will be recorded.
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={retake}
                disabled={stage !== "captured"}
                className="agent-press flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 py-3.5 text-sm font-medium text-white"
              >
                <RefreshCw className="h-4 w-4" /> Retake
              </button>
              <button
                onClick={submit}
                disabled={stage !== "captured"}
                className="agent-press flex flex-[1.4] items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white"
                style={{ background: accent }}
              >
                <Check className="h-4 w-4" />
                {type === "check_in" ? "Confirm check-in" : "Confirm check-out"}
              </button>
            </div>
          </div>
        )}

        {error && stage !== "error" && (
          <div className="mb-3 rounded-xl bg-red-500/15 px-4 py-2 text-xs text-red-200">{error}</div>
        )}
      </div>
    </div>
  );
}

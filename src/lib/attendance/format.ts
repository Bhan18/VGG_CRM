"use client";

/**
 * Shared helpers for the attendance admin UI.
 */

import type { AttendanceRecord, AttendanceSettings } from "./types";

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function statusColor(status: string): string {
  switch (status) {
    case "PRESENT":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case "LATE":
      return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    case "HALF_DAY":
      return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900";
    case "ABSENT":
      return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
    case "ON_LEAVE":
      return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900";
    case "CANCELLED":
      return "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-300 dark:border-zinc-800";
  }
}

export function describeSettings(s: AttendanceSettings): string {
  const minH = Math.floor(s.minimumWorkingMinutes / 60);
  const minM = s.minimumWorkingMinutes % 60;
  return `Office starts ${s.officeStartTime} · Late after ${s.lateAfterMinutes}m · Half-day after ${s.halfDayAfterMinutes}m · Min work ${minH}h ${minM}m · Photo ${s.requirePhoto ? "required" : "optional"} · GPS ${s.requireLocation ? "required" : "optional"} · ${s.timezone}`;
}

/**
 * Resolve a stored photo path to a displayable URL.
 *
 * In Supabase mode, photos are stored as paths (e.g. "checkin-1234-abc.jpg")
 * in the private `attendance-photos` bucket. To display them we need a
 * signed URL from the server.
 *
 * - If the path is already a full URL (http/https) or a relative path (/),
 *   return it as-is (legacy / sandbox mode).
 * - Otherwise, return the /api/attendance/photo-url endpoint which
 *   generates a fresh signed URL on demand.
 */
export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  // Supabase storage path — fetch signed URL via API
  return `/api/attendance/photo-url?path=${encodeURIComponent(path)}`;
}

export type { AttendanceRecord, AttendanceSettings };

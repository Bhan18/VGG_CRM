"use client";

// TanStack Query hooks for agent reads. Attendance + profile go through
// /api/attendance/staff/* (attendance Supabase, httpOnly cookie auth).
// Content stays on the main Supabase project via /api/agent/content.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AttendanceLogEntry,
  ContentBrochure,
  ContentPost,
  ContentVideo,
} from "@/lib/agent/types";

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

type MappedRecord = {
  id: string;
  attendanceDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  workingMinutes: number | null;
  status: string;
};

export function useAttendanceLog(days = 14) {
  return useQuery<AttendanceLogEntry[]>({
    queryKey: ["agent", "attendance-log", days],
    queryFn: async () => {
      const res = await fetch(`/api/attendance/staff/history?days=${days}`, {
        credentials: "include",
      });
      const data = await jsonOrThrow(res);
      const items: MappedRecord[] = Array.isArray(data?.items) ? data.items : [];
      return items
        .filter(
          (r) =>
            r.checkInTime ||
            r.status === "ON_LEAVE" ||
            r.status === "ABSENT" ||
            r.status === "HALF_DAY",
        )
        .map((r) => ({
          id: r.id,
          attendanceDate: r.attendanceDate.slice(0, 10),
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          workingMinutes: r.workingMinutes,
          status: r.status as AttendanceLogEntry["status"],
        }));
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useContentPosts() {
  return useQuery<ContentPost[]>({
    queryKey: ["agent", "content", "posts"],
    queryFn: async () => {
      const res = await fetch("/api/agent/content?type=posts", { credentials: "include" });
      return jsonOrThrow(res);
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useContentBrochures() {
  return useQuery<ContentBrochure[]>({
    queryKey: ["agent", "content", "brochures"],
    queryFn: async () => {
      const res = await fetch("/api/agent/content?type=brochures", { credentials: "include" });
      return jsonOrThrow(res);
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useContentVideos() {
  return useQuery<ContentVideo[]>({
    queryKey: ["agent", "content", "videos"],
    queryFn: async () => {
      const res = await fetch("/api/agent/content?type=videos", { credentials: "include" });
      return jsonOrThrow(res);
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export interface AttendanceSubmitInput {
  kind: "CHECK_IN" | "CHECK_OUT";
  photoBlobBase64: string;
  geo: { latitude: number; longitude: number } | null;
  reason?: string | null;
}

export interface AttendanceSubmitResult {
  ok: boolean;
  error?: string;
  code?: string;
}

export function useSubmitAttendance() {
  const qc = useQueryClient();
  return useMutation<AttendanceSubmitResult, Error, AttendanceSubmitInput>({
    mutationFn: async (input) => {
      // 1. Upload the photo to attendance storage.
      const uploadRes = await fetch("/api/attendance/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: input.photoBlobBase64, kind: input.kind }),
      });
      const upload = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        return { ok: false, error: upload?.error ?? "Photo upload failed." };
      }

      // 2. Mark attendance (server validates geofence + policy).
      const markRes = await fetch("/api/attendance/staff/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: input.kind,
          photoPath: upload.path ?? null,
          gps: input.geo,
          reason: input.reason ?? null,
        }),
      });
      const mark = await markRes.json().catch(() => ({}));
      if (!markRes.ok) {
        return { ok: false, error: mark?.error ?? "Could not mark attendance.", code: mark?.code };
      }
      return { ok: true };
    },
    onSuccess: (result) => {
      if (result.ok) {
        qc.invalidateQueries({ queryKey: ["agent", "attendance-log"] });
      }
    },
  });
}

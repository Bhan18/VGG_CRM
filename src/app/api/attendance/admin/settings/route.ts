import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { getSettings, updateSettings } from "@/lib/attendance/settings";
import {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from "@/lib/attendance/locations";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/admin/settings
 * Attendance rules + permitted locations.
 */
export const GET = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const [settings, locations] = await Promise.all([getSettings(), listLocations()]);
    return jsonNoCache({ settings, locations });
  },
  "admin/settings GET",
);

function hhmm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
}

function posInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * PATCH /api/attendance/admin/settings
 * Update attendance rules.
 * Body: { settings: { officeStartTime?, officeEndTime?, checkInEarlyWindowMinutes?,
 *   checkOutEarlyWindowMinutes?, lateAfterMinutes?, halfDayAfterMinutes?,
 *   minimumWorkingMinutes?, requirePhoto?, requireLocation?, timezone?, reasonOptions? } }
 */
export const PATCH = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const body = await req.json().catch(() => null);
    const s = body?.settings;
    if (!s || typeof s !== "object") {
      return errorResponse("settings object is required", 400);
    }

    const patch: Record<string, unknown> = {};
    const t1 = hhmm(s.officeStartTime);
    const t2 = hhmm(s.officeEndTime);
    if (s.officeStartTime !== undefined) {
      if (!t1) return errorResponse("officeStartTime must be HH:MM", 400);
      patch.officeStartTime = t1;
    }
    if (s.officeEndTime !== undefined) {
      if (!t2) return errorResponse("officeEndTime must be HH:MM", 400);
      patch.officeEndTime = t2;
    }
    for (const k of [
      "checkInEarlyWindowMinutes",
      "checkOutEarlyWindowMinutes",
      "lateAfterMinutes",
      "halfDayAfterMinutes",
      "minimumWorkingMinutes",
    ] as const) {
      if (s[k] !== undefined) {
        const n = posInt(s[k]);
        if (n === null) return errorResponse(`${k} must be a non-negative integer`, 400);
        patch[k] = n;
      }
    }
    if (s.requirePhoto !== undefined) patch.requirePhoto = !!s.requirePhoto;
    if (s.requireLocation !== undefined) patch.requireLocation = !!s.requireLocation;
    if (s.timezone !== undefined) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: String(s.timezone) });
      } catch {
        return errorResponse("Invalid timezone", 400);
      }
      patch.timezone = String(s.timezone);
    }
    if (s.reasonOptions !== undefined) {
      if (!Array.isArray(s.reasonOptions)) {
        return errorResponse("reasonOptions must be an array of strings", 400);
      }
      const cleaned = s.reasonOptions.map((r: unknown) => String(r).trim()).filter(Boolean);
      if (cleaned.length === 0) return errorResponse("At least one reason option is required", 400);
      patch.reasonOptions = cleaned;
    }
    if (Object.keys(patch).length === 0) {
      return errorResponse("Nothing to update", 400);
    }

    const updated = await updateSettings(patch as Parameters<typeof updateSettings>[0]);
    return jsonNoCache({ settings: updated });
  },
  "admin/settings PATCH",
);

/**
 * POST /api/attendance/admin/settings
 * Location actions (body.action):
 *   - "add-location": { name, latitude, longitude, allowedRadius? }
 *   - "update-location": { id, name?, latitude?, longitude?, allowedRadius?, status? }
 *   - "delete-location": { id }
 */
export const POST = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const body = await req.json().catch(() => null);
    const ctx = { adminUserIdentifier: guard.employee.employee_code };

    if (body?.action === "add-location") {
      const name = String(body?.name ?? "").trim();
      const latitude = Number(body?.latitude);
      const longitude = Number(body?.longitude);
      const allowedRadius = body?.allowedRadius != null ? Number(body.allowedRadius) : 200;
      if (!name) return errorResponse("name is required", 400);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return errorResponse("Valid latitude (-90..90) is required", 400);
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return errorResponse("Valid longitude (-180..180) is required", 400);
      }
      if (!Number.isFinite(allowedRadius) || allowedRadius <= 0) {
        return errorResponse("allowedRadius must be a positive number (meters)", 400);
      }
      try {
        const item = await createLocation({ name, latitude, longitude, allowedRadius }, ctx);
        return jsonNoCache({ item }, 201);
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : "Could not add location", 400);
      }
    }

    if (body?.action === "update-location") {
      if (!body?.id) return errorResponse("id is required", 400);
      const patch: Record<string, unknown> = {};
      if (body?.name != null) {
        if (!String(body.name).trim()) return errorResponse("name cannot be empty", 400);
        patch.name = String(body.name).trim();
      }
      if (body?.latitude != null) {
        const n = Number(body.latitude);
        if (!Number.isFinite(n) || n < -90 || n > 90) return errorResponse("Invalid latitude", 400);
        patch.latitude = n;
      }
      if (body?.longitude != null) {
        const n = Number(body.longitude);
        if (!Number.isFinite(n) || n < -180 || n > 180) return errorResponse("Invalid longitude", 400);
        patch.longitude = n;
      }
      if (body?.allowedRadius != null) {
        const n = Number(body.allowedRadius);
        if (!Number.isFinite(n) || n <= 0) return errorResponse("Invalid allowedRadius", 400);
        patch.allowed_radius = n;
      }
      if (body?.status != null) {
        if (!["ACTIVE", "INACTIVE"].includes(body.status)) return errorResponse("Invalid status", 400);
        patch.status = body.status;
      }
      if (Object.keys(patch).length === 0) return errorResponse("Nothing to update", 400);
      try {
        const item = await updateLocation(String(body.id), patch as Parameters<typeof updateLocation>[1], ctx);
        return jsonNoCache({ item });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not update location";
        if (message.includes("not found")) return errorResponse(message, 404);
        return errorResponse(message, 400);
      }
    }

    if (body?.action === "delete-location") {
      if (!body?.id) return errorResponse("id is required", 400);
      try {
        await deleteLocation(String(body.id), ctx);
        return jsonNoCache({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not delete location";
        if (message.includes("not found")) return errorResponse(message, 404);
        return errorResponse(message, 400);
      }
    }

    return errorResponse('action must be "add-location", "update-location" or "delete-location"', 400);
  },
  "admin/settings POST",
);
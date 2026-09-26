import { NextRequest } from "next/server";
import { getSettings, updateSettings } from "@/lib/attendance/settings";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";
import { mapSettings } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async () => {
  const settings = await getSettings();
  return json({ settings: mapSettings(settings) });
}, "settings/get");

export const PUT = withAttendanceErrorHandler(async (req: NextRequest) => {
  const ctx = await resolveAdminContext();
  const body = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid JSON body", 400);
  const old = await getSettings();
  const updated = await updateSettings(body);
  const { logAudit } = await import("@/lib/attendance/audit");
  await logAudit({
    ctx,
    action: "SETTINGS_UPDATED",
    entityType: "AttendanceSetting",
    entityId: "singleton",
    oldValue: old,
    newValue: updated,
  });
  return json({ settings: mapSettings(updated) });
}, "settings/update");

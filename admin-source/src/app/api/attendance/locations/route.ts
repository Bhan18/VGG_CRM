import { NextRequest } from "next/server";
import { listLocations, createLocation } from "@/lib/attendance/locations";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";
import { mapLocation, mapLocationArray } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async () => {
  const items = await listLocations();
  return json({ items: mapLocationArray(items) });
}, "locations/list");

export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const ctx = await resolveAdminContext();
  const body = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid JSON body", 400);
  const { name, latitude, longitude, allowedRadius } = body;
  if (!name || typeof latitude !== "number" || typeof longitude !== "number") {
    return errorResponse("Missing name / latitude / longitude", 400);
  }
  const loc = await createLocation({ name, latitude, longitude, allowedRadius }, ctx);
  return json({ location: mapLocation(loc) }, { status: 201 });
}, "locations/create");

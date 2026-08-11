/**
 * Permitted attendance locations service — backed by Supabase.
 */

import {
  getAttendanceAdminClient,
  type AdminContext,
} from "./client";
import { logAudit } from "./audit";
import {
  unwrapMany,
  unwrapSingle,
  unwrapNullable,
} from "./supabase-helpers";

export type AttendanceLocationRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
};

export async function listLocations(): Promise<AttendanceLocationRow[]> {
  const supabase = getAttendanceAdminClient();
  return unwrapMany(
    supabase
      .from("attendance_locations")
      .select("*")
      .order("status", { ascending: true })
      .order("name", { ascending: true }),
  );
}

export async function createLocation(
  input: {
    name: string;
    latitude: number;
    longitude: number;
    allowedRadius?: number;
  },
  ctx: AdminContext,
): Promise<AttendanceLocationRow> {
  const supabase = getAttendanceAdminClient();
  const created = await unwrapSingle<AttendanceLocationRow>(
    supabase
      .from("attendance_locations")
      .insert({
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        allowed_radius: input.allowedRadius ?? 200,
        status: "ACTIVE",
      })
      .select()
      .single(),
  );
  await logAudit({
    ctx,
    action: "LOCATION_CREATED",
    entityType: "AttendanceLocation",
    entityId: created.id,
    newValue: created,
  });
  return created;
}

export async function updateLocation(
  id: string,
  input: Partial<{
    name: string;
    latitude: number;
    longitude: number;
    allowed_radius: number;
    status: "ACTIVE" | "INACTIVE";
  }>,
  ctx: AdminContext,
): Promise<AttendanceLocationRow> {
  const supabase = getAttendanceAdminClient();
  const old = await unwrapNullable<AttendanceLocationRow>(
    supabase.from("attendance_locations").select("*").eq("id", id).single(),
  );
  if (!old) throw new Error("Location not found");

  const data = { ...input, updated_at: new Date().toISOString() };
  const updated = await unwrapSingle<AttendanceLocationRow>(
    supabase
      .from("attendance_locations")
      .update(data)
      .eq("id", id)
      .select()
      .single(),
  );
  await logAudit({
    ctx,
    action: "LOCATION_UPDATED",
    entityType: "AttendanceLocation",
    entityId: id,
    oldValue: old,
    newValue: updated,
  });
  return updated;
}

export async function deleteLocation(
  id: string,
  ctx: AdminContext,
): Promise<{ ok: true }> {
  const supabase = getAttendanceAdminClient();
  const old = await unwrapNullable<AttendanceLocationRow>(
    supabase.from("attendance_locations").select("*").eq("id", id).single(),
  );
  if (!old) throw new Error("Location not found");
  await supabase.from("attendance_locations").delete().eq("id", id);
  await logAudit({
    ctx,
    action: "LOCATION_DELETED",
    entityType: "AttendanceLocation",
    entityId: id,
    oldValue: old,
  });
  return { ok: true };
}

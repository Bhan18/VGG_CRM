/**
 * Company resources service — backed by Supabase.
 *
 * Admin uploads brochures / policies / forms / notices to the private
 * 'company-resources' storage bucket. Staff browse them via the staff
 * portal. Visibility can be ALL or DEPARTMENT-specific.
 */

import { randomBytes } from "node:crypto";
import { getAttendanceAdminClient, type AdminContext } from "./client";
import { logAudit } from "./audit";
import {
  unwrapMany,
  unwrapSingle,
  unwrapNullable,
} from "./supabase-helpers";

const BUCKET_NAME = "company-resources";
const SIGNED_URL_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export type CompanyResourceRow = {
  id: string;
  title: string;
  description: string | null;
  category: "General" | "Brochure" | "Policy" | "Form" | "Notice" | "Training" | "Other";
  file_path: string;
  file_type: string;
  file_size: number;
  visibility: "ALL" | "DEPARTMENT";
  department_filter: string | null;
  sort_order: number;
  status: "ACTIVE" | "INACTIVE";
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateResourceInput = {
  title: string;
  description?: string;
  category?: CompanyResourceRow["category"];
  visibility?: "ALL" | "DEPARTMENT";
  departmentFilter?: string;
  // File content as base64 data URL
  fileData: string;
  fileName: string;
  fileType?: string;
};

export async function listResources(opts?: {
  status?: "ACTIVE" | "INACTIVE";
  category?: string;
  department?: string;
}): Promise<CompanyResourceRow[]> {
  const supabase = getAttendanceAdminClient();
  let query = supabase
    .from("attendance_company_resources")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.category) query = query.eq("category", opts.category);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as CompanyResourceRow[];

  // Filter by department (for staff portal)
  if (opts?.department) {
    rows = rows.filter(
      (r) =>
        r.visibility === "ALL" || r.department_filter === opts.department,
    );
  }

  return rows;
}

export async function getResource(
  id: string,
): Promise<CompanyResourceRow | null> {
  const supabase = getAttendanceAdminClient();
  return unwrapNullable(
    supabase
      .from("attendance_company_resources")
      .select("*")
      .eq("id", id)
      .single(),
  );
}

export async function createResource(
  input: CreateResourceInput,
  ctx: AdminContext,
): Promise<CompanyResourceRow> {
  const supabase = getAttendanceAdminClient();

  // Decode + upload file
  const raw = input.fileData.startsWith("data:")
    ? input.fileData.split(",")[1] ?? ""
    : input.fileData;
  const buf = Buffer.from(raw, "base64");
  const id = randomBytes(8).toString("hex");
  const safeName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `${input.category ?? "General"}-${Date.now()}-${id}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buf, {
      contentType: input.fileType ?? "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`File upload failed: ${uploadError.message}`);
  }

  const created = await unwrapSingle<CompanyResourceRow>(
    supabase
      .from("attendance_company_resources")
      .insert({
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? "General",
        file_path: filePath,
        file_type: input.fileType ?? "application/octet-stream",
        file_size: buf.byteLength,
        visibility: input.visibility ?? "ALL",
        department_filter: input.departmentFilter ?? null,
        sort_order: 0,
        status: "ACTIVE",
        uploaded_by: ctx.adminUserIdentifier,
      })
      .select("*")
      .single(),
  );

  await logAudit({
    ctx,
    action: "RESOURCE_CREATED",
    entityType: "AttendanceCompanyResource",
    entityId: created.id,
    newValue: { title: created.title, category: created.category },
  });

  return created;
}

export async function updateResource(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    category: CompanyResourceRow["category"];
    visibility: "ALL" | "DEPARTMENT";
    department_filter: string;
    sort_order: number;
    status: "ACTIVE" | "INACTIVE";
  }>,
  ctx: AdminContext,
): Promise<CompanyResourceRow> {
  const supabase = getAttendanceAdminClient();
  const old = await getResource(id);
  if (!old) throw new Error("Resource not found");

  const updated = await unwrapSingle<CompanyResourceRow>(
    supabase
      .from("attendance_company_resources")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single(),
  );

  await logAudit({
    ctx,
    action: "RESOURCE_UPDATED",
    entityType: "AttendanceCompanyResource",
    entityId: id,
    oldValue: old,
    newValue: updated,
  });

  return updated;
}

export async function deleteResource(
  id: string,
  ctx: AdminContext,
): Promise<{ ok: true }> {
  const supabase = getAttendanceAdminClient();
  const old = await getResource(id);
  if (!old) throw new Error("Resource not found");

  // Delete file from storage
  if (old.file_path) {
    await supabase.storage.from(BUCKET_NAME).remove([old.file_path]);
  }

  await supabase.from("attendance_company_resources").delete().eq("id", id);

  await logAudit({
    ctx,
    action: "RESOURCE_DELETED",
    entityType: "AttendanceCompanyResource",
    entityId: id,
    oldValue: old,
  });

  return { ok: true };
}

/**
 * Generate a fresh signed URL for downloading a resource.
 */
export async function getResourceSignedUrl(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const supabase = getAttendanceAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

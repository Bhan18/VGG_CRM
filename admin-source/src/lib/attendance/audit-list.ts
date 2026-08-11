/**
 * Audit log query helper (read-only) — backed by Supabase.
 */

import { getAttendanceAdminClient } from "./client";
import { unwrapMany } from "./supabase-helpers";

export type AttendanceAuditLogRow = {
  id: string;
  admin_user_identifier: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
};

export async function listAudit(opts?: {
  entityType?: string;
  entityId?: string;
  adminUserIdentifier?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: AttendanceAuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = getAttendanceAdminClient();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts?.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("attendance_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts?.entityType) query = query.eq("entity_type", opts.entityType);
  if (opts?.entityId) query = query.eq("entity_id", opts.entityId);
  if (opts?.adminUserIdentifier)
    query = query.eq("admin_user_identifier", opts.adminUserIdentifier);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    items: (data ?? []) as AttendanceAuditLogRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

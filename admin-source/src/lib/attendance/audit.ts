/**
 * Audit log helper. Every admin mutation in the attendance module
 * MUST funnel through `logAudit()` so we keep a complete audit trail
 * in the attendance Supabase project (never in the existing DB).
 */

import { getAttendanceAdminClient, type AdminContext } from "./client";

export async function logAudit(params: {
  ctx: AdminContext;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  try {
    const supabase = getAttendanceAdminClient();
    const { error } = await supabase.from("attendance_audit_logs").insert({
      admin_user_identifier: params.ctx.adminUserIdentifier,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
    });
    if (error) {
      console.error("[attendance] audit log failed:", error.message);
    }
  } catch (err) {
    // Audit log failure must NOT crash the main operation.
    console.error("[attendance] audit log failed:", err);
  }
}

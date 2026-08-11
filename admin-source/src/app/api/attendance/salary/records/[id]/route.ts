import { NextRequest } from "next/server";
import { updateSalaryRecordStatus } from "@/lib/attendance/salary";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAttendanceErrorHandler(async (req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.status || !["DRAFT", "APPROVED", "PAID"].includes(body.status)) {
    return errorResponse("Invalid status", 400);
  }
  const record = await updateSalaryRecordStatus(
    id,
    body.status as "DRAFT" | "APPROVED" | "PAID",
    adminCtx,
  );
  return json({ record });
}, "salary/records/status");

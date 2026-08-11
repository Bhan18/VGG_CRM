import { NextRequest } from "next/server";
import { setEmployeeStatus } from "@/lib/attendance/employees";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAttendanceErrorHandler(async (req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.status || !["ACTIVE", "INACTIVE"].includes(body.status)) {
    return errorResponse("Invalid status", 400);
  }
  const emp = await setEmployeeStatus(id, body.status as "ACTIVE" | "INACTIVE", adminCtx);
  return json({ employee: emp });
}, "employees/set-status");

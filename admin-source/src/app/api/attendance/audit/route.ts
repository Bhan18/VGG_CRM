import { NextRequest } from "next/server";
import { listAudit } from "@/lib/attendance/audit-list";
import { json, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
  const result = await listAudit({ entityType, entityId, page, pageSize });
  return json(result);
}, "audit");

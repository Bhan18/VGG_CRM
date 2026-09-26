import { NextRequest } from "next/server";
import { listRecords } from "@/lib/attendance/records";
import { json, withAttendanceErrorHandler } from "@/lib/attendance/server-context";
import { mapRecordArray } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();
  const day = date.toISOString().slice(0, 10);
  const result = await listRecords({
    dateFrom: day,
    dateTo: day,
    page: 1,
    pageSize: 200,
  });
  return json({
    items: mapRecordArray(result.items as Parameters<typeof mapRecordArray>[0]),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}, "today");

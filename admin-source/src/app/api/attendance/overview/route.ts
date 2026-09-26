import { NextRequest } from "next/server";
import { getOverview } from "@/lib/attendance/records";
import { json, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();
  const overview = await getOverview(date);
  return json(overview);
}, "overview");

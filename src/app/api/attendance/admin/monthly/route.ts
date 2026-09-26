import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { getMonthlyReport } from "@/lib/attendance/records";
import { getSettings } from "@/lib/attendance/settings";
import { withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/** "YYYY-MM" for today in the given IANA timezone. */
function monthStrInZone(tz: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

// Monthly attendance report for every employee — powers the admin
// attendance dashboard. Query params: month (YYYY-MM, defaults to the
// current month in the org timezone), department.
export const GET = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const sp = req.nextUrl.searchParams;
    const settings = await getSettings();
    const month = sp.get("month") ?? monthStrInZone(settings.timezone);

    // Block future months (nothing to show yet).
    const currentMonths = monthStrInZone(settings.timezone);
    if (month > currentMonths) {
      return jsonNoCache({ error: "No data for future months." }, 400);
    }

    const report = await getMonthlyReport({
      month,
      department: sp.get("department") ?? undefined,
    });

    return jsonNoCache(report);
  },
  "admin/monthly",
);
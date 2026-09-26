import { NextRequest, NextResponse } from "next/server";
import { getExportRows } from "@/lib/attendance/records";
import { toCsv, toSpreadsheetXml } from "@/lib/attendance/export";

export const dynamic = "force-dynamic";

const COLUMNS = [
  { key: "employeeId", label: "Employee ID" },
  { key: "employeeName", label: "Employee Name" },
  { key: "department", label: "Department" },
  { key: "date", label: "Date" },
  { key: "checkIn", label: "Check-In" },
  { key: "checkOut", label: "Check-Out" },
  { key: "workingHours", label: "Working Hours" },
  { key: "status", label: "Status" },
] as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
    const employeeId = url.searchParams.get("employeeId") ?? undefined;
    const department = url.searchParams.get("department") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
    const dateTo = url.searchParams.get("dateTo") ?? undefined;

    const rows = await getExportRows({ employeeId, department, status, dateFrom, dateTo });

    if (format === "xls" || format === "xlsx") {
      const xml = toSpreadsheetXml(rows, COLUMNS as unknown as { key: string; label: string }[], "Attendance");
      return new Response(xml, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="attendance-export.xls"`,
        },
      });
    }

    const csv = toCsv(rows, COLUMNS as unknown as { key: string; label: string }[]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-export.csv"`,
      },
    });
  } catch (err) {
    console.error("[attendance/export] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Export failed.",
        detail: message,
        hint:
          message.includes("Cannot read properties of undefined")
            ? "Run `bun run db:push` to regenerate the Prisma client."
            : "",
      },
      { status: 500 },
    );
  }
}

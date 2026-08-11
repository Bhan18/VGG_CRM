import { NextRequest } from "next/server";
import { listEmployees, createEmployee } from "@/lib/attendance/employees";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";
import { mapEmployee, mapEmployeeArray } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "ACTIVE" | "INACTIVE" | null;
  const department = url.searchParams.get("department") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const items = await listEmployees({ status: status ?? undefined, department, search });
  return json({ items: mapEmployeeArray(items) });
}, "employees/list");

export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const ctx = await resolveAdminContext();
  const body = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid JSON body", 400);
  const { employeeCode, name, phone, department, role, password, profilePhoto } = body;
  if (!employeeCode || !name || !phone || !department) {
    return errorResponse("Missing required fields: employeeCode, name, phone, department", 400);
  }
  try {
    const emp = await createEmployee(
      { employeeCode, name, phone, department, role, password, profilePhoto },
      ctx,
    );
    return json({ employee: mapEmployee(emp) }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create employee";
    if (msg.includes("unique") || msg.includes("duplicate"))
      return errorResponse("Employee code already exists", 409);
    throw e;
  }
}, "employees/create");

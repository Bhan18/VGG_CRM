import { NextRequest } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { listResources } from "@/lib/attendance/resources";
import { json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/staff/resources
 * Returns company resources visible to the logged-in employee.
 * Filters by their department if visibility = DEPARTMENT.
 */
export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const items = await listResources({
    status: "ACTIVE",
    department: staff.employee.department,
  });

  // Strip internal fields — staff only see title/description/category/fileType
  const safe = items.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    fileType: r.file_type,
    fileSize: r.file_size,
    filePath: r.file_path, // used to fetch signed URL on demand
    createdAt: r.created_at,
  }));

  return json({ items: safe });
}, "staff/resources");

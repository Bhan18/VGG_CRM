import { NextRequest, NextResponse } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { getAttendanceAdminClient } from "@/lib/attendance/client";
import {
  verifyPassword,
  hashPassword,
} from "@/lib/attendance/employees";
import { errorResponse } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
    const staff = await getStaffFromSession(employeeId);
    if (!staff) return errorResponse("Unauthorized", 401);

    const body = await req.json().catch(() => null);
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return errorResponse("Current and new password are required", 400);
    }
    if (newPassword.length < 4) {
      return errorResponse("New password must be at least 4 characters", 400);
    }
    if (newPassword === currentPassword) {
      return errorResponse(
        "New password must be different from the current password",
        400,
      );
    }

    const employee = staff.employee;
    if (!verifyPassword(currentPassword, employee.password_hash)) {
      return errorResponse("Current password is incorrect", 403);
    }

    const supabase = getAttendanceAdminClient();
    const { error } = await supabase
      .from("attendance_employees")
      .update({
        password_hash: hashPassword(newPassword),
        updated_at: new Date().toISOString(),
      })
      .eq("id", employee.id);

    if (error) {
      console.error(
        "[attendance/staff/change-password] db error:",
        error.message,
      );
      return errorResponse("Could not update password. Please try again.", 500);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[attendance/staff/change-password] error:", err);
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json(
      {
        error: "Password change failed due to a server error.",
        detail: message,
      },
      { status: 500 },
    );
  }
}

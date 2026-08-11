/**
 * Server-side admin context helper.
 *
 * In production this inspects the EXISTING dashboard's authenticated
 * session (NextAuth / Supabase Auth / custom cookie) and returns the
 * admin's identifier. The attendance module NEVER re-implements admin
 * authentication — it only bridges to the existing session.
 *
 * In this sandbox we return a sentinel admin id so the demo works
 * end-to-end. Replace `resolveAdminContext` with your real session
 * check when wiring into your existing dashboard.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AdminContext } from "./client";

export async function resolveAdminContext(): Promise<AdminContext> {
  // TODO: replace with your existing dashboard's session check.
  // Example using NextAuth:
  //   const session = await getServerSession(authOptions);
  //   if (!session?.user) throw new Response("Unauthorized", { status: 401 });
  //   return { adminUserIdentifier: session.user.email };

  // Sandbox fallback: read a cookie set by the dashboard, or default.
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("attendance-admin-id")?.value;
  return { adminUserIdentifier: adminCookie ?? "admin@local" };
}

export type Json<T> = T;

export function json<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export function errorResponse(message: string, status = 400, code?: string) {
  return Response.json(
    code ? { error: message, code } : { error: message },
    { status },
  );
}

/**
 * Wrap an API route handler with structured error logging + response.
 *
 * Every attendance API route should be wrapped in this so that any
 * uncaught error returns a structured JSON response with the actual
 * error message + a targeted hint, instead of a bare 500.
 *
 * Usage:
 *   export const POST = withAttendanceErrorHandler(async (req) => { ... });
 *   export const GET = withAttendanceErrorHandler(async (req, ctx) => { ... });
 */
export function withAttendanceErrorHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
  routeName: string,
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`[attendance/${routeName}] error:`, err);
      const message = err instanceof Error ? err.message : String(err);

      // Targeted hints for the most common failure modes.
      let hint = "";
      if (
        message.includes("Cannot read properties of undefined (reading 'findUnique')") ||
        message.includes("Cannot read properties of undefined (reading 'findFirst')") ||
        message.includes("Cannot read properties of undefined (reading 'count')") ||
        message.includes("Cannot read properties of undefined (reading 'findMany')") ||
        message.includes("Cannot read properties of undefined (reading 'create')") ||
        message.includes("Cannot read properties of undefined (reading 'update')") ||
        message.includes("Cannot read properties of undefined (reading 'upsert')") ||
        message.includes("Cannot read properties of undefined (reading 'delete')") ||
        message.includes("attendanceEmployee is undefined") ||
        message.includes("attendanceRecord is undefined") ||
        message.includes("attendanceLocation is undefined") ||
        message.includes("attendanceSetting is undefined") ||
        message.includes("attendanceAuditLog is undefined")
      ) {
        hint =
          "A Prisma attendance model is undefined. The Prisma client was generated before the attendance schema was added. Run: bun run db:push  (then restart the dev server with Ctrl+C and `bun run dev`).";
      } else if (message.includes("no such table")) {
        hint =
          "An attendance table is missing from the database. Run: bun run db:push";
      } else if (message.includes("unique constraint")) {
        hint = "Duplicate value on a unique column (e.g. employeeCode or attendanceDate).";
      } else if (message.includes("sharp") || message.includes("module not found")) {
        hint = "A required module is not installed. Run: bun install";
      } else if (message.includes("ATTENDANCE_STAFF_SESSION_SECRET")) {
        hint = "Staff session secret is missing. Add ATTENDANCE_STAFF_SESSION_SECRET to .env";
      }

      return NextResponse.json(
        {
          error: `Server error in /api/attendance/${routeName}`,
          detail: message,
          hint,
          route: routeName,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }
  };
}

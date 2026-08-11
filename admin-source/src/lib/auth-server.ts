
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AuthResult =
  | { authorized: true; userId: string; email?: string }
  | { authorized: false; response: NextResponse };

/**
 * Verifies that an incoming NextRequest includes a valid Supabase access token
 * belonging to an active user with 'admin' role privileges.
 */
export async function verifyAdminRequest(req: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") || req.nextUrl.searchParams.get("token");

    if (!token) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Unauthorized: Missing authentication token" },
          { status: 401 }
        ),
      };
    }

    // Verify token with Supabase Auth
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Unauthorized: Invalid or expired authentication token" },
          { status: 401 }
        ),
      };
    }

    // Verify user profile role in user_profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Forbidden: User profile not found" },
          { status: 403 }
        ),
      };
    }

    if (!profile.active) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Forbidden: Account is deactivated" },
          { status: 403 }
        ),
      };
    }

    if (profile.role !== "administrator") {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Forbidden: Admin privileges required" },
          { status: 403 }
        ),
      };
    }

    return { authorized: true, userId: user.id, email: user.email };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Authentication verification failed";
    return {
      authorized: false,
      response: NextResponse.json({ error: msg }, { status: 500 }),
    };
  }
}



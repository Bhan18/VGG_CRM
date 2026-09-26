
// API: /api/admin/users — create new user (admin only)
// Uses service role key server-side to bypass RLS for user creation.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, role } = await req.json();
    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation
      user_metadata: { name },
    });

    if (authError) throw authError;

    // Update user_profile with role
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .update({ name, role, active: true })
      .eq("id", authData.user.id);

    if (profileError) throw profileError;

    return NextResponse.json({ id: authData.user.id, email, name, role });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}



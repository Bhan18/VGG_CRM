
// API: /api/admin/reset-password — admin resets a user's password
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { userId, password } = await req.json();
    if (!userId || !password) {
      return NextResponse.json({ error: "Missing userId or password" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

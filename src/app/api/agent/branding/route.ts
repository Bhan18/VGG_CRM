// Public branding endpoint. No auth required — called on app boot to fetch
// app_name + logo. The same logo is used as the favicon. Geofence config
// is NEVER returned here (or anywhere else) — that's admin-only.
// Colors are NOT configurable — they are baked into the app (emerald+gold).

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/agent/server-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface BrandingResponse {
  app_name: string;
  tagline: string | null;
  logo_url: string | null;
}

const DEFAULTS: BrandingResponse = {
  app_name: "Agent",
  tagline: null,
  logo_url: null,
};

export async function GET() {
  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json(DEFAULTS);
  }
  const { data, error } = await sb
    .from("agent_settings")
    .select("app_name, tagline, logo_url")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(DEFAULTS);
  }
  return NextResponse.json({
    app_name: data.app_name ?? DEFAULTS.app_name,
    tagline: data.tagline ?? null,
    logo_url: data.logo_url ?? null,
  } satisfies BrandingResponse);
}

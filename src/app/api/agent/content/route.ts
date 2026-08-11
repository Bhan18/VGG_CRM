import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/agent/server-supabase";
import type { ContentBrochure, ContentPost, ContentVideo } from "@/lib/agent/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Published company content is public to the app — no auth gate. The agent
// authenticates against the attendance Supabase project, so the old
// resolveAgentFromRequest check no longer applies here.
export async function GET(req: Request) {
  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "posts";

  let table: string;
  if (type === "posts") table = "agent_content_posts";
  else if (type === "brochures") table = "agent_content_brochures";
  else if (type === "videos") table = "agent_content_videos";
  else return NextResponse.json({ error: "Unknown content type." }, { status: 400 });

  const { data, error } = await sb
    .from(table)
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Failed to load content." }, { status: 500 });
  }
  const filtered = (data ?? []).filter((r: Record<string, unknown>) => r.published_at);
  if (type === "posts") return NextResponse.json(filtered as ContentPost[]);
  if (type === "brochures") return NextResponse.json(filtered as ContentBrochure[]);
  return NextResponse.json(filtered as ContentVideo[]);
}

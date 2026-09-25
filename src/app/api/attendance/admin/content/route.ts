import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { getServerSupabase } from "@/lib/agent/server-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Admin content management (main Supabase project, service-role key).
// Posts / brochures / videos shown in the staff Content tab.
// published_at = null means draft (hidden from staff).
// File uploads are out of scope here — paste hosted file/image URLs.

const TABLES: Record<string, string> = {
  posts: "agent_content_posts",
  brochures: "agent_content_brochures",
  videos: "agent_content_videos",
};

// Only these columns are writable per type (unknown columns would fail).
const FIELDS: Record<string, string[]> = {
  posts: ["title", "body", "cover_image_url", "attachment_url", "published_at", "pinned"],
  brochures: ["title", "description", "cover_image_url", "file_url", "file_size_bytes", "published_at"],
  videos: ["title", "description", "thumbnail_url", "video_url", "duration_seconds", "published_at"],
};

function pick(type: string, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of FIELDS[type] ?? []) {
    if (body[k] !== undefined) {
      let v = body[k];
      if (v === "") v = null;
      out[k] = v;
    }
  }
  return out;
}

function guard(sb: unknown, req: NextRequest) {
  if (!sb) {
    return NextResponse.json({ error: "Content service not configured." }, { status: 503 });
  }
  return null;
}

/**
 * GET /api/attendance/admin/content
 * All content rows (including drafts) for every type.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin.authorized) return admin.response;

  const sb = getServerSupabase();
  const bad = guard(sb, req);
  if (bad) return bad;

  const out: Record<string, unknown[]> = {};
  for (const [type, table] of Object.entries(TABLES)) {
    const { data, error } = await sb!
      .from(table)
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) {
      return NextResponse.json({ error: `Could not load ${type}.` }, { status: 500 });
    }
    out[type] = data ?? [];
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/attendance/admin/content
 * Add a post/brochure/video. Body: { type, ...fields }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin.authorized) return admin.response;

  const sb = getServerSupabase();
  const bad = guard(sb, req);
  if (bad) return bad;

  const body = await req.json().catch(() => null);
  const type = String(body?.type ?? "");
  const table = TABLES[type];
  if (!table) {
    return NextResponse.json({ error: "type must be posts, brochures or videos." }, { status: 400 });
  }
  const row = pick(type, body ?? {});
  if (!row.title || !String(row.title).trim()) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const { data, error } = await sb!.from(table).insert(row).select().single();
  if (error) {
    return NextResponse.json({ error: "Could not create item." }, { status: 500 });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}

/**
 * PATCH /api/attendance/admin/content
 * Edit an item. Body: { type, id, ...fields }
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin.authorized) return admin.response;

  const sb = getServerSupabase();
  const bad = guard(sb, req);
  if (bad) return bad;

  const body = await req.json().catch(() => null);
  const type = String(body?.type ?? "");
  const table = TABLES[type];
  if (!table) {
    return NextResponse.json({ error: "type must be posts, brochures or videos." }, { status: 400 });
  }
  if (!body?.id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  const row = pick(type, body ?? {});
  if (row.title !== undefined && !String(row.title ?? "").trim()) {
    return NextResponse.json({ error: "title cannot be empty." }, { status: 400 });
  }
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await sb!.from(table).update(row).eq("id", body.id).select().single();
  if (error) {
    return NextResponse.json({ error: "Could not update item." }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}

/**
 * DELETE /api/attendance/admin/content?type=..&id=..
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin.authorized) return admin.response;

  const sb = getServerSupabase();
  const bad = guard(sb, req);
  if (bad) return bad;

  const sp = req.nextUrl.searchParams;
  const table = TABLES[sp.get("type") ?? ""];
  const id = sp.get("id");
  if (!table || !id) {
    return NextResponse.json({ error: "type and id are required." }, { status: 400 });
  }

  const { error } = await sb!.from(table).delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Could not delete item." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
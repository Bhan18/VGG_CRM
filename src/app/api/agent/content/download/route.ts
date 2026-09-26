import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-side download proxy. Content files live in the main Supabase
// project's storage; a plain cross-origin <a download> is ignored by
// browsers. This route fetches the file server-side and streams it back
// with a Content-Disposition: attachment header so it actually downloads.

function safeFilename(raw: string | null, fallback: string): string {
  const name = raw?.trim() || "";
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  if (cleaned && cleaned.length <= 120) return cleaned;
  return fallback;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const filename = req.nextUrl.searchParams.get("filename");

  if (!url) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url." }, { status: 400 });
  }
  // Only allow http(s)
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "Invalid protocol." }, { status: 400 });
  }

  let upstream;
  try {
    upstream = await fetch(target.toString());
  } catch {
    return NextResponse.json({ error: "Could not reach file." }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "File unavailable." }, { status: 502 });
  }

  const fallback = target.pathname.split("/").pop()?.replace(/[^a-zA-Z0-9._-]/g, "_") || "download";
  const name = safeFilename(filename, fallback);
  const buffer = Buffer.from(await upstream.arrayBuffer());

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  headers.set("Content-Length", String(buffer.byteLength));
  headers.set("Content-Disposition", `attachment; filename="${name}"`);
  headers.set("Cache-Control", "no-store");

  return new NextResponse(buffer, { status: 200, headers });
}
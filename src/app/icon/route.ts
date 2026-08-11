import { getServerSupabase } from "@/lib/agent/server-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET() {
  const sb = getServerSupabase();
  if (!sb) return new Response(null, { status: 404 });

  const { data, error } = await sb
    .from("agent_settings")
    .select("logo_url")
    .eq("id", 1)
    .maybeSingle();
  const logoUrl = data?.logo_url ?? null;
  if (error || !logoUrl) return new Response(null, { status: 404 });

  try {
    const res = await fetch(logoUrl, { cache: "no-store" });
    if (!res.ok) return new Response(null, { status: 404 });
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get("content-type") ?? inferContentType(logoUrl) ?? "image/png";
    return new Response(buf, {
      headers: { "Content-Type": contentType, ...CACHE_HEADERS },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

function inferContentType(url: string): string | null {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "ico") return "image/x-icon";
  return null;
}

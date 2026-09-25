import fs from "node:fs";
import path from "node:path";
import { getServerSupabase } from "./server-supabase";

export async function getLogoUrl(): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("agent_settings")
    .select("logo_url")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data?.logo_url) return null;
  return data.logo_url;
}

export async function fetchLogoBuffer(): Promise<{ buffer: Buffer; contentType: string } | null> {
  const url = await getLogoUrl();
  if (url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        return {
          buffer: Buffer.from(await res.arrayBuffer()),
          contentType: res.headers.get("content-type") ?? "",
        };
      }
    } catch {
      /* fall through to local logo */
    }
  }
  // Fallback: the bundled VGG logo (also used when branding was never
  // configured in the database).
  try {
    const buffer = fs.readFileSync(path.join(process.cwd(), "public", "logo.svg"));
    return { buffer, contentType: "image/svg+xml" };
  } catch {
    return null;
  }
}

export const ICON_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
};

export function pngResponse(buf: Buffer, headers: Record<string, string>): Response {
  const ab = Uint8Array.from(buf).buffer;
  return new Response(ab, { headers: { "Content-Type": "image/png", ...headers } });
}

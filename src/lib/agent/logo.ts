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
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") ?? "",
    };
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

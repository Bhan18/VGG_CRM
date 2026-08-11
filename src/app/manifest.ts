import type { MetadataRoute } from "next";
import { getServerSupabase } from "@/lib/agent/server-supabase";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let appName = "Agent";
  let logoUrl: string | null = null;

  const sb = getServerSupabase();
  if (sb) {
    const { data } = await sb
      .from("agent_settings")
      .select("app_name, logo_url")
      .eq("id", 1)
      .maybeSingle();
    if (data?.app_name) appName = data.app_name;
    if (data?.logo_url) logoUrl = data.logo_url;
  }

  const icons: MetadataRoute.Manifest["icons"] = [];
  if (logoUrl) {
    icons.push({ src: logoUrl, sizes: "any", type: "image/png", purpose: "any" });
  }
  icons.push(
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  );

  return {
    name: appName,
    short_name: appName,
    description: "Field workforce companion app",
    start_url: "/agent",
    scope: "/agent",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f3",
    theme_color: "#1a5c47",
    categories: ["productivity", "business"],
    icons,
  };
}

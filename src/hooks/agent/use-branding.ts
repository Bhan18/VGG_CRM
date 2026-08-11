"use client";

// Branding hook — fetches app_name + logo_url from /api/agent/branding
// and applies them to the document at runtime:
//   • document.title = app_name
//   • <link rel="icon"> = logo_url  (logo doubles as favicon)
//   • <link rel="apple-touch-icon"> = logo_url
//   • CSS var --brand-app-name is NOT used; components read branding directly
//
// Colors are NOT configurable — they are baked into the app (emerald+gold).

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BrandingResponse } from "@/app/api/agent/branding/route";

const DEFAULTS: BrandingResponse = {
  app_name: "Agent",
  tagline: null,
  logo_url: null,
};

export function useBranding() {
  const { data, isLoading } = useQuery<BrandingResponse>({
    queryKey: ["agent", "branding"],
    queryFn: async () => {
      // Default browser caching — the endpoint sends Cache-Control, so
      // repeat opens reuse the cached branding instead of refetching.
      const res = await fetch("/api/agent/branding");
      if (!res.ok) return DEFAULTS;
      return (await res.json()) as BrandingResponse;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const branding = data ?? DEFAULTS;

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (branding.app_name) {
      document.title = branding.app_name;
      for (const name of ["apple-mobile-web-app-title", "application-name"]) {
        let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
        if (!meta) {
          meta = document.createElement("meta");
          meta.name = name;
          document.head.appendChild(meta);
        }
        meta.content = branding.app_name;
      }
    }
    if (branding.logo_url) {
      // Favicon/apple-touch-icon are already server-rendered at /icon
      // (which proxies the DB logo through the cached /icon route) — so we
      // do NOT rewrite them here with the raw logo URL. Only ensure the
      // apple-mobile-web-app-title meta stays in sync via the block above.
    }
  }, [branding.app_name, branding.logo_url]);

  return { branding, isLoading };
}

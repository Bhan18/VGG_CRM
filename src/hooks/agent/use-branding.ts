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
      const res = await fetch("/api/agent/branding", { cache: "no-store" });
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
    }
    if (branding.logo_url) {
      // Update all existing icon links to point at the logo.
      const links = document.querySelectorAll<HTMLLinkElement>(
        "link[rel~='icon'], link[rel~='apple-touch-icon']"
      );
      links.forEach((l) => {
        l.href = branding.logo_url!;
      });
      // Make sure an icon link exists.
      if (links.length === 0) {
        const l = document.createElement("link");
        l.rel = "icon";
        l.href = branding.logo_url;
        document.head.appendChild(l);
      }
      // Also set the apple-touch-icon explicitly if missing.
      const apple = document.querySelector<HTMLLinkElement>(
        "link[rel='apple-touch-icon']"
      );
      if (!apple) {
        const l = document.createElement("link");
        l.rel = "apple-touch-icon";
        l.href = branding.logo_url;
        document.head.appendChild(l);
      }
    }
  }, [branding.app_name, branding.logo_url]);

  return { branding, isLoading };
}

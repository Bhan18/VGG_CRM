"use client";

// BrandingBootstrap — fires the branding fetch on first paint so the
// document title and favicon get updated to the admin-configured values
// before any screen renders.

import { useBranding } from "@/hooks/agent/use-branding";

export function BrandingBootstrap() {
  useBranding();
  return null;
}

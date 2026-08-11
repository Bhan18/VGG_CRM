"use client";

// Top app bar — uses branding app_name + logo. Title shows the active tab.

import { useAgentNav } from "@/hooks/agent/use-agent-nav";
import { useBranding } from "@/hooks/agent/use-branding";
import { BrandLogo } from "./brand-logo";

export function TopBar() {
  const { tab } = useAgentNav();
  const { branding } = useBranding();
  const title =
    tab === "home"
      ? "Home"
      : tab === "content"
        ? "Content"
        : tab === "attendance"
          ? "Attendance"
          : "Profile";

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/90 px-4 py-3 backdrop-blur safe-pt"
      style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}
    >
      <div className="flex items-center gap-2">
        <BrandLogo size={28} />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div
        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: "color-mix(in srgb, var(--brand-emerald) 10%, white)",
          color: "var(--brand-emerald)",
        }}
      >
        {branding.app_name}
      </div>
    </header>
  );
}

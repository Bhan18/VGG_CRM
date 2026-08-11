"use client";

// BrandLogo — shows the configured logo, or a monogram fallback derived
// from the app name. Used everywhere a logo is needed (splash, sign-in,
// top bar, admin shell).

import { useBranding } from "@/hooks/agent/use-branding";

interface BrandLogoProps {
  size?: number;
  className?: string;
  // When true, render on a white background (for dark backgrounds like
  // the splash). When false, render with the brand tint background.
  onDark?: boolean;
}

export function BrandLogo({ size = 40, className, onDark = false }: BrandLogoProps) {
  const { branding } = useBranding();

  if (branding.logo_url) {
    return (
      <img
        src={branding.logo_url}
        alt={branding.app_name}
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          borderRadius: size * 0.22,
          background: onDark ? "rgba(255,255,255,0.15)" : "transparent",
        }}
      />
    );
  }

  // Monogram fallback — first 1-2 letters of the app name.
  const monogram = (branding.app_name || "A")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: onDark
          ? "rgba(255,255,255,0.15)"
          : "linear-gradient(135deg, var(--brand-emerald) 0%, var(--brand-emerald-soft) 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.42,
        letterSpacing: "-0.02em",
      }}
      aria-label={branding.app_name}
    >
      {monogram}
    </div>
  );
}

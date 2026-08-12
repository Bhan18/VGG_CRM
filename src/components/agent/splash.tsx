"use client";

// Splash — shown while the app boots / auth is being restored.
// The parent controls dismissal: `leaving` triggers the fade-out,
// then the component is unmounted.
//
// - "logo"    : full-screen brand logo (first boot / cold open)
// - "spinner" : branded loading circle only (pull-to-refresh while logged in)

import { BrandLogo } from "./brand-logo";

export function AgentSplash({
  leaving,
  variant = "logo",
}: {
  leaving: boolean;
  variant?: "logo" | "spinner";
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--brand-emerald) 25%, #000), #0a0f0d 75%)",
        opacity: leaving ? 0 : 1,
      }}
    >
      {variant === "logo" ? (
        <BrandLogo size={96} onDark />
      ) : (
        <div className="relative h-16 w-16">
          <span
            className="absolute inset-0 rounded-full"
            style={{ border: "2px solid rgba(255,255,255,0.08)" }}
          />
          <span
            className="absolute inset-0 animate-spin rounded-full"
            style={{
              border: "3px solid transparent",
              borderTopColor: "var(--brand-gold)",
              borderRightColor: "var(--brand-gold)",
            }}
          />
          <span
            className="absolute inset-2.5 rounded-full"
            style={{
              border: "3px solid transparent",
              borderBottomColor: "var(--brand-emerald-soft)",
              borderLeftColor: "var(--brand-emerald-soft)",
              animation: "splash-spin-reverse 1.6s linear infinite",
            }}
          />
          <span
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: "var(--brand-gold)",
              animation: "splash-pulse 1.2s ease-in-out infinite",
            }}
          />
        </div>
      )}
      <style>{`
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes splash-spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

"use client";

// Splash — shown for ~1.2s while the app boots and auth is being restored.
// Uses branding app_name + logo (or monogram fallback). Colors are fixed
// (emerald + gold).

import { useEffect, useState } from "react";
import { useBranding } from "@/hooks/agent/use-branding";
import { BrandLogo } from "./brand-logo";

export function AgentSplash({ onDone }: { onDone: () => void }) {
  const { branding } = useBranding();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 900);
    const t2 = setTimeout(onDone, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--brand-emerald) 25%, #000), #0a0f0d 75%)",
        opacity: leaving ? 0 : 1,
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-emerald) 0%, var(--brand-emerald-soft) 100%)",
            boxShadow:
              "0 12px 36px -8px color-mix(in srgb, var(--brand-emerald) 60%, transparent)",
          }}
        >
          <BrandLogo size={56} onDark />
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-white">{branding.app_name}</div>
          {branding.tagline && (
            <div className="mt-1 text-xs text-white/60">{branding.tagline}</div>
          )}
        </div>
        <div className="mt-2 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "var(--brand-gold)",
                animation: `splash-pulse 1s ${i * 0.15}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

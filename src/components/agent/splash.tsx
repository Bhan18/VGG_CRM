"use client";

// Splash — shown while the app boots / auth is being restored.
// The parent controls dismissal: `leaving` triggers the fade-out,
// then the component is unmounted. Shows the logo image until the
// app is ready.

import { BrandLogo } from "./brand-logo";

export function AgentSplash({ leaving }: { leaving: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--brand-emerald) 25%, #000), #0a0f0d 75%)",
        opacity: leaving ? 0 : 1,
      }}
    >
      <BrandLogo size={96} onDark />
    </div>
  );
}

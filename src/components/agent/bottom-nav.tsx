"use client";

// Bottom navigation — 4 tabs. Sticky, safe-area aware, hidden keyboard.

import { Home, FileText, Clock3, User } from "lucide-react";
import { useAgentNav } from "@/hooks/agent/use-agent-nav";
import type { AgentTab } from "@/lib/agent/types";

const TABS: { id: AgentTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "attendance", label: "Attendance", icon: Clock3 },
  { id: "content", label: "Content", icon: FileText },
  { id: "profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const { tab, setTab } = useAgentNav();
  return (
    <nav
      className="sticky bottom-0 z-30 border-t bg-white/95 backdrop-blur safe-pb"
      style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}
      aria-label="Primary"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`agent-press agent-tab-${active ? "active" : "idle"} flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium tap-highlight-none`}
              style={{ color: active ? "var(--brand-emerald)" : "color-mix(in srgb, var(--brand-ink) 55%, transparent)" }}
              aria-current={active ? "page" : undefined}
            >
              <span className="agent-tab-icon transition-transform">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

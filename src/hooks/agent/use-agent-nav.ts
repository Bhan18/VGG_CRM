"use client";

// Tiny Zustand store for client-side navigation. Server state is handled
// by TanStack Query in use-agent-data.ts.

import { create } from "zustand";
import type { AgentTab, AgentContentTab } from "@/lib/agent/types";

interface AgentNavState {
  tab: AgentTab;
  setTab: (t: AgentTab) => void;
  contentTab: AgentContentTab;
  setContentTab: (t: AgentContentTab) => void;
}

export const useAgentNav = create<AgentNavState>((set) => ({
  tab: "home",
  setTab: (t) => set({ tab: t }),
  contentTab: "posts",
  setContentTab: (t) => set({ contentTab: t }),
}));

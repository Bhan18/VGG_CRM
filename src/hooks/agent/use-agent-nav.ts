"use client";

// Tiny Zustand store for client-side navigation. Server state is handled
// by TanStack Query in use-agent-data.ts.
<<<<<<< HEAD
//
// Tabs mount lazily on first visit, then STAY mounted (visited) so
// switching back is instant — cached data, no skeletons, state kept.
=======
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6

import { create } from "zustand";
import type { AgentTab, AgentContentTab } from "@/lib/agent/types";

interface AgentNavState {
  tab: AgentTab;
<<<<<<< HEAD
  visited: AgentTab[];
=======
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6
  setTab: (t: AgentTab) => void;
  contentTab: AgentContentTab;
  setContentTab: (t: AgentContentTab) => void;
}

export const useAgentNav = create<AgentNavState>((set) => ({
  tab: "home",
<<<<<<< HEAD
  visited: ["home"],
  setTab: (t) =>
    set((s) => ({
      tab: t,
      visited: s.visited.includes(t) ? s.visited : [...s.visited, t],
    })),
=======
  setTab: (t) => set({ tab: t }),
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6
  contentTab: "posts",
  setContentTab: (t) => set({ contentTab: t }),
}));

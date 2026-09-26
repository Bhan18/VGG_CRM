"use client";

// Admin dashboard shell — shown when a staff session has the ADMIN role.
// Replaces the staff tabs with: Overview, Attendance, Salary, Employees.

import { useState } from "react";
import {
  LayoutDashboard,
  CalendarCheck2,
  CalendarOff,
  Banknote,
  Users,
  LogOut,
  Shield,
  Settings,
  Target,
  Newspaper,
<<<<<<< HEAD
  IndianRupee,
=======
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6
} from "lucide-react";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";
import { useBranding } from "@/hooks/agent/use-branding";
import { BrandLogo } from "@/components/agent/brand-logo";
import { OverviewTab } from "./overview-tab";
import { AttendanceTab } from "./attendance-tab";
import { SalaryTab } from "./salary-tab";
import { EmployeesTab } from "./employees-tab";
import { LeavesTab } from "./leaves-tab";
import { LeadsAdminTab } from "./leads-tab";
import { ContentAdminTab } from "./content-tab";
import { SettingsTab } from "./settings-tab";
<<<<<<< HEAD
import { PaymentsTab } from "./payments-tab";

type AdminTab = "overview" | "attendance" | "leaves" | "salary" | "employees" | "leads" | "payments" | "content" | "settings";
=======

type AdminTab = "overview" | "attendance" | "leaves" | "salary" | "employees" | "leads" | "content" | "settings";
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6

const TABS: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "attendance", label: "Attendance", icon: CalendarCheck2 },
  { id: "leaves", label: "Leaves", icon: CalendarOff },
  { id: "salary", label: "Salary", icon: Banknote },
<<<<<<< HEAD
  { id: "payments", label: "Payments", icon: IndianRupee },
=======
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6
  { id: "employees", label: "Employees", icon: Users },
  { id: "leads", label: "Leads", icon: Target },
  { id: "content", label: "Content", icon: Newspaper },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AdminDashboard() {
  const { signOut, session } = useAgentAuth();
  const { branding } = useBranding();
  const [tab, setTabState] = useState<AdminTab>("overview");
  // Tabs mount lazily on first visit, then STAY mounted (hidden) so
  // switching back is instant — no refetch, no skeletons, state kept.
  const [visited, setVisited] = useState<Set<AdminTab>>(() => new Set(["overview"]));
  const setTab = (t: AdminTab) => {
    setVisited((prev) => (prev.has(t) ? prev : new Set(prev).add(t)));
    setTabState(t);
  };

  const name = session?.employee?.name ?? "Admin";

  return (
    <div className="agent-shell flex min-h-dynamic flex-col">
      <header
<<<<<<< HEAD
        className="sticky top-0 z-20 px-4 pb-3 pt-3 backdrop-blur-xl safe-pt"
        style={{
          background:
            "color-mix(in srgb, var(--brand-paper) 78%, transparent)",
          borderBottom: "1px solid color-mix(in srgb, var(--brand-emerald) 12%, transparent)",
        }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-emerald), var(--brand-emerald-soft))",
              }}
            >
              <BrandLogo size={22} />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold tracking-tight">Admin</div>
              <div className="truncate text-[11px] text-[var(--brand-ink)]/50">{name}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium sm:inline-flex"
              style={{
                background: "color-mix(in srgb, var(--brand-emerald) 10%, transparent)",
                color: "var(--brand-emerald)",
              }}
            >
              <Shield className="h-3 w-3" />
              {branding.app_name}
            </span>
            <button
              onClick={() => void signOut()}
              className="agent-press flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                background: "color-mix(in srgb, var(--brand-checkout) 10%, transparent)",
                color: "var(--brand-checkout)",
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
=======
        className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/90 px-4 py-3 backdrop-blur safe-pt"
        style={{
          borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <BrandLogo size={30} />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Admin</div>
            <div className="max-w-[180px] truncate text-[10px] text-[var(--brand-ink)]/55">
              {name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex"
            style={{
              background: "color-mix(in srgb, var(--brand-emerald) 10%, white)",
              color: "var(--brand-emerald)",
            }}
          >
            <Shield className="h-3 w-3" />
            {branding.app_name}
          </span>
          <button
            onClick={() => void signOut()}
            className="agent-press flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{
              background: "color-mix(in srgb, var(--brand-checkout) 8%, white)",
              color: "var(--brand-checkout)",
              border: "1px solid color-mix(in srgb, var(--brand-checkout) 20%, transparent)",
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6
        </div>
      </header>

      <nav
<<<<<<< HEAD
        className="no-scrollbar sticky top-[61px] z-10 px-4 py-2.5 backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--brand-paper) 78%, transparent)",
          borderBottom: "1px solid color-mix(in srgb, var(--brand-emerald) 10%, transparent)",
        }}
      >
        <div className="mx-auto flex w-full max-w-5xl gap-1.5 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="agent-press flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium"
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(135deg, var(--brand-emerald), var(--brand-emerald-soft))",
                        color: "#fff",
                        boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--brand-emerald) 70%, transparent)",
                      }
                    : {
                        color: "color-mix(in srgb, var(--brand-ink) 55%, transparent)",
                      }
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="agent-frame flex-1 px-4 pb-10 pt-5">
        <div className="mx-auto w-full max-w-5xl">
=======
        className="no-scrollbar sticky top-[64px] z-10 flex gap-1 overflow-x-auto border-b bg-white/80 px-3 py-2 backdrop-blur"
        style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="agent-press flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
              style={
                active
                  ? {
                      background: "color-mix(in srgb, var(--brand-emerald) 12%, white)",
                      color: "var(--brand-emerald)",
                    }
                  : { color: "var(--brand-ink)/60" }
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <main className="agent-frame flex-1 px-4 pb-8 pt-4">
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6
        {visited.has("overview") && (
          <div hidden={tab !== "overview"}><OverviewTab /></div>
        )}
        {visited.has("attendance") && (
          <div hidden={tab !== "attendance"}><AttendanceTab /></div>
        )}
        {visited.has("leaves") && (
          <div hidden={tab !== "leaves"}><LeavesTab /></div>
        )}
        {visited.has("salary") && (
          <div hidden={tab !== "salary"}><SalaryTab /></div>
        )}
        {visited.has("employees") && (
          <div hidden={tab !== "employees"}><EmployeesTab /></div>
        )}
        {visited.has("leads") && (
          <div hidden={tab !== "leads"}><LeadsAdminTab /></div>
        )}
<<<<<<< HEAD
        {visited.has("payments") && (
          <div hidden={tab !== "payments"}><PaymentsTab /></div>
        )}
=======
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6
        {visited.has("content") && (
          <div hidden={tab !== "content"}><ContentAdminTab /></div>
        )}
        {visited.has("settings") && (
          <div hidden={tab !== "settings"}><SettingsTab /></div>
        )}
<<<<<<< HEAD
        </div>
=======
>>>>>>> b5863bd91c6df220ccc66682e8ec1aff705e97b6
      </main>
    </div>
  );
}

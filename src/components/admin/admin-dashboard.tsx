"use client";

// Admin dashboard shell — shown when a staff session has the ADMIN role.
// Replaces the staff tabs with: Overview, Attendance, Salary, Employees.

import { useState } from "react";
import {
  LayoutDashboard,
  CalendarCheck2,
  Banknote,
  Users,
  LogOut,
  Shield,
  Settings,
} from "lucide-react";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";
import { useBranding } from "@/hooks/agent/use-branding";
import { BrandLogo } from "@/components/agent/brand-logo";
import { OverviewTab } from "./overview-tab";
import { AttendanceTab } from "./attendance-tab";
import { SalaryTab } from "./salary-tab";
import { EmployeesTab } from "./employees-tab";
import { SettingsTab } from "./settings-tab";

type AdminTab = "overview" | "attendance" | "salary" | "employees" | "settings";

const TABS: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "attendance", label: "Attendance", icon: CalendarCheck2 },
  { id: "salary", label: "Salary", icon: Banknote },
  { id: "employees", label: "Employees", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AdminDashboard() {
  const { signOut, session } = useAgentAuth();
  const { branding } = useBranding();
  const [tab, setTab] = useState<AdminTab>("overview");

  const name = session?.employee?.name ?? "Admin";

  return (
    <div className="agent-shell flex min-h-dynamic flex-col">
      <header
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
        </div>
      </header>

      <nav
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
        {tab === "overview" && <OverviewTab />}
        {tab === "attendance" && <AttendanceTab />}
        {tab === "salary" && <SalaryTab />}
        {tab === "employees" && <EmployeesTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

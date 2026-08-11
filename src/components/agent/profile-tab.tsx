"use client";

// Profile tab — READ-ONLY. All fields come from the attendance module
// (attendance_employees), managed by the admin dashboard.

import {
  User,
  Phone,
  BadgeCheck,
  Building2,
  Briefcase,
  Shield,
  LogOut,
  CalendarClock,
} from "lucide-react";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";

export function ProfileTab() {
  const { signOut, session } = useAgentAuth();
  const p = session?.employee;

  if (!p) {
    return (
      <div className="px-4 pb-6 pt-3">
        <div className="agent-card p-8 text-center">
          <User className="mx-auto h-9 w-9 text-[var(--brand-ink)]/30" />
          <div className="mt-2 text-sm font-medium">Profile unavailable</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-3">
      {/* Identity card */}
      <div
        className="overflow-hidden rounded-2xl text-white"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-emerald) 0%, var(--brand-emerald-soft) 100%)",
        }}
      >
        <div className="flex items-center gap-4 p-5">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold"
            style={{ background: "color-mix(in srgb, var(--brand-gold) 25%, transparent)" }}
          >
            {p.profilePhoto ? (
              <img src={p.profilePhoto} alt={p.name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              initials(p.name)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{p.name}</div>
            <div className="truncate text-xs text-white/80">{p.role ?? "Staff"}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/70">
              <BadgeCheck className="h-3 w-3" />
              {p.employeeCode ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Read-only fields */}
      <div className="mt-4 flex flex-col gap-2">
        <Field icon={Phone} label="Phone" value={p.phone ?? "—"} />
        <Field icon={Briefcase} label="Role" value={p.role ?? "—"} />
        <Field icon={Building2} label="Department" value={p.department ?? "—"} />
        <Field
          icon={CalendarClock}
          label="Joined on"
          value={
            p.createdAt
              ? new Date(p.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"
          }
        />
      </div>

      {/* Note: read-only reminder */}
      <div
        className="mt-4 rounded-xl p-4"
        style={{
          background: "color-mix(in srgb, var(--brand-gold) 10%, white)",
          border: "1px solid color-mix(in srgb, var(--brand-gold) 25%, transparent)",
        }}
      >
        <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "#8a6d24" }}>
          <Shield className="h-3.5 w-3.5" />
          Profile is managed by your administrator
        </div>
        <div className="mt-1 text-[11px] text-[var(--brand-ink)]/60 leading-relaxed">
          If any detail looks incorrect, please contact your administrator to update it.
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={() => void signOut()}
        className="agent-press mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium"
        style={{
          background: "color-mix(in srgb, var(--brand-checkout) 8%, white)",
          color: "var(--brand-checkout)",
          border: "1px solid color-mix(in srgb, var(--brand-checkout) 20%, transparent)",
        }}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="agent-card flex items-center gap-3 p-3.5">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{
          background: "color-mix(in srgb, var(--brand-emerald) 10%, white)",
          color: "var(--brand-emerald)",
        }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55">
          {label}
        </div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

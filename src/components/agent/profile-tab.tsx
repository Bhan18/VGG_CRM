"use client";

// Profile tab — READ-ONLY. All fields come from the attendance module
// (attendance_employees), managed by the admin dashboard.

import { useState } from "react";
import {
  User,
  Phone,
  BadgeCheck,
  Building2,
  Briefcase,
  Shield,
  LogOut,
  CalendarClock,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
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
            p.joiningDate
              ? new Date(`${p.joiningDate}T00:00:00`).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : p.createdAt
                ? new Date(p.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"
          }
        />
      </div>

      {/* Change password */}
      <ChangePasswordCard />

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

function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!current || !next) {
      setError("Enter your current and new password.");
      return;
    }
    if (next.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/staff/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not change password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed", {
        description: "Use your new password next time you sign in.",
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white pl-3 pr-10 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-emerald)_20%,transparent)]";

  return (
    <div className="mt-4">
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
          style={{
            background: "color-mix(in srgb, var(--brand-emerald) 8%, white)",
            borderBottom: open
              ? "1px solid color-mix(in srgb, var(--brand-emerald) 12%, transparent)"
              : "none",
          }}
          aria-expanded={open}
        >
          <KeyRound className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          <div className="flex-1 text-sm font-semibold">Change password</div>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            style={{ color: "var(--brand-ink)" }}
          />
        </button>

        {open && (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pwd-current"
                className="text-xs font-medium text-[var(--brand-ink)]/70"
              >
                Current password
              </label>
              <div className="relative">
                <input
                  id="pwd-current"
                  name="currentPassword"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  disabled={busy}
                  className={inputClass}
                  placeholder="••••••••"
                />
                <EyeToggle show={show} onToggle={() => setShow((v) => !v)} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pwd-new"
                className="text-xs font-medium text-[var(--brand-ink)]/70"
              >
                New password
              </label>
              <input
                id="pwd-new"
                name="newPassword"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                disabled={busy}
                className={inputClass}
                placeholder="At least 4 characters"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pwd-confirm"
                className="text-xs font-medium text-[var(--brand-ink)]/70"
              >
                Confirm new password
              </label>
              <input
                id="pwd-confirm"
                name="confirmPassword"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
                className={inputClass}
                placeholder="Re-enter new password"
              />
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--brand-checkout) 10%, white)",
                  color: "var(--brand-checkout)",
                  border: "1px solid color-mix(in srgb, var(--brand-checkout) 22%, transparent)",
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="agent-press mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-emerald) 0%, var(--brand-emerald-soft) 100%)",
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function EyeToggle({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--brand-ink)]/50"
      aria-label={show ? "Hide password" : "Show password"}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
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

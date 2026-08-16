"use client";

// Admin Settings tab — change the signed-in admin's password.
// Reuses the staff change-password route (works for any session).

import { useState } from "react";
import { KeyRound, Eye, EyeOff, Loader2, Shield, Check } from "lucide-react";
import { toast } from "sonner";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";

export function SettingsTab() {
  const { session } = useAgentAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = session?.employee;

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
    if (next === current) {
      setError("New password must be different from the current password.");
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
    "w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-emerald)_20%,transparent)]";

  return (
    <div className="mx-auto max-w-md">
      <div className="agent-card p-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--brand-emerald) 12%, white)" }}
          >
            <Shield className="h-5 w-5" style={{ color: "var(--brand-emerald)" }} />
          </div>
          <div>
            <div className="text-sm font-semibold">{p?.name ?? "Admin"}</div>
            <div className="text-xs text-[var(--brand-ink)]/55">
              {p?.employeeCode ?? ""} · {p?.role ?? ""}
            </div>
          </div>
        </div>
      </div>

      <div className="agent-card mt-3 p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          <div className="text-sm font-semibold">Change password</div>
        </div>
        <p className="mt-1 text-xs text-[var(--brand-ink)]/55">
          You'll use the new password next time you sign in.
        </p>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-pwd-current" className="text-xs font-medium text-[var(--brand-ink)]/70">
              Current password
            </label>
            <div className="relative">
              <input
                id="admin-pwd-current"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                disabled={busy}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-pwd-new" className="text-xs font-medium text-[var(--brand-ink)]/70">
              New password
            </label>
            <div className="relative">
              <input
                id="admin-pwd-new"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                disabled={busy}
                className={`${inputClass} pr-10`}
                placeholder="At least 4 characters"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--brand-ink)]/45"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-pwd-confirm" className="text-xs font-medium text-[var(--brand-ink)]/70">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="admin-pwd-confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
                className={inputClass}
                placeholder="Repeat new password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="agent-press flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--brand-emerald)" }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

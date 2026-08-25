"use client";

// Admin Settings tab — change the signed-in admin's MPIN.

import { useState } from "react";
import { KeyRound, Loader2, Shield, Check } from "lucide-react";
import { toast } from "sonner";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";

export function SettingsTab() {
  const { session } = useAgentAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = session?.employee;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!current || !next) {
      setError("Enter your current and new MPIN.");
      return;
    }
    if (!/^\d{4}$/.test(next)) {
      setError("New MPIN must be exactly 4 digits.");
      return;
    }
    if (next === current) {
      setError("New MPIN must be different from the current MPIN.");
      return;
    }
    if (next !== confirm) {
      setError("New MPINs do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/staff/change-mpin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldMpin: current, newMpin: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not change MPIN.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("MPIN changed", {
        description: "Use your new MPIN next time you sign in.",
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
              {p?.employeeCode ?? ""} / {p?.role ?? ""}
            </div>
          </div>
        </div>
      </div>

      <div className="agent-card mt-3 p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          <div className="text-sm font-semibold">Change MPIN</div>
        </div>
        <p className="mt-1 text-xs text-[var(--brand-ink)]/55">
          You will use the new MPIN next time you sign in.
        </p>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-mpin-current" className="text-xs font-medium text-[var(--brand-ink)]/70">
              Current MPIN
            </label>
            <input
              id="admin-mpin-current"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={current}
              onChange={(e) => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={busy}
              className={inputClass}
              placeholder="----"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-mpin-new" className="text-xs font-medium text-[var(--brand-ink)]/70">
              New MPIN
            </label>
            <input
              id="admin-mpin-new"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={next}
              onChange={(e) => setNext(e.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={busy}
              className={inputClass}
              placeholder="4 digits"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-mpin-confirm" className="text-xs font-medium text-[var(--brand-ink)]/70">
              Confirm new MPIN
            </label>
            <input
              id="admin-mpin-confirm"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={busy}
              className={inputClass}
              placeholder="Re-enter new MPIN"
            />
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
            {busy ? "Saving..." : "Update MPIN"}
          </button>
        </form>
      </div>
    </div>
  );
}

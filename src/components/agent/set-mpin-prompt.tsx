"use client";

// Post-login prompt to set a 4-digit MPIN for quick access.
// Shown after password login if no MPIN is set. Dismissible.

import { useState } from "react";
import { KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface SetMpinPromptProps {
  employeeId: string;
  onClose: () => void;
}

export function SetMpinPrompt({ employeeId, onClose }: SetMpinPromptProps) {
  const [mpin, setMpin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!/^\d{4}$/.test(mpin)) {
      setError("MPIN must be exactly 4 digits.");
      return;
    }
    if (mpin !== confirm) {
      setError("MPINs do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/admin/set-mpin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, mpin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not set MPIN.");
        return;
      }
      toast.success("MPIN set", {
        description: "You can now use your MPIN for quick login.",
      });
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-emerald)_20%,transparent)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
            <div className="text-sm font-semibold">Set up quick login</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--brand-ink)]/55">
          Set a 4-digit MPIN so you can quickly open the app next time without typing your password.
        </p>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">
              MPIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={mpin}
              onChange={(e) => setMpin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={busy}
              autoFocus
              className={`${inputClass} text-center text-lg font-semibold tracking-[0.3em]`}
              placeholder="----"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">
              Confirm MPIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={busy}
              className={`${inputClass} text-center text-lg font-semibold tracking-[0.3em]`}
              placeholder="----"
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {busy ? "Saving..." : "Set MPIN"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-[var(--brand-ink)]/50 hover:text-[var(--brand-ink)]/70"
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}

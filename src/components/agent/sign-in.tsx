"use client";

// Sign-in screen — employee code + password. No email field, no demo fallback.

import { useState } from "react";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";
import { useBranding } from "@/hooks/agent/use-branding";
import { Loader2, Eye, EyeOff, Lock, Fingerprint } from "lucide-react";
import { BrandLogo } from "./brand-logo";

export function AgentSignIn() {
  const { signIn } = useAgentAuth();
  const { branding } = useBranding();
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!employeeCode.trim() || !password) {
      setError("Enter your employee code and password.");
      return;
    }
    setBusy(true);
    const res = await signIn(employeeCode.trim(), password);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Sign-in failed.");
  }

  return (
    <div className="min-h-dynamic flex flex-col" style={{ background: "var(--brand-paper)" }}>
      <div
        className="flex-shrink-0 px-6 pt-12 pb-10 text-white safe-pt"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-emerald) 0%, var(--brand-emerald-soft) 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <BrandLogo size={48} onDark />
          <div>
            <div className="text-base font-semibold">{branding.app_name}</div>
            {branding.tagline && (
              <div className="text-xs text-white/70">{branding.tagline}</div>
            )}
          </div>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex-1 -mt-6 rounded-t-3xl bg-[var(--brand-paper)] px-6 pt-8 pb-8 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="agent-employee-code" className="text-xs font-medium text-[var(--brand-ink)]/70">
            Employee code
          </label>
          <div className="relative">
            <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-ink)]/40" />
            <input
              id="agent-employee-code"
              name="employeeCode"
              type="text"
              autoComplete="username"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white pl-10 pr-3 py-3 text-sm outline-none focus:border-[var(--brand-emerald)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-emerald)_20%,transparent)]"
              placeholder="e.g. EMP001"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="agent-password" className="text-xs font-medium text-[var(--brand-ink)]/70">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-ink)]/40" />
            <input
              id="agent-password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white pl-10 pr-10 py-3 text-sm outline-none focus:border-[var(--brand-emerald)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-emerald)_20%,transparent)]"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--brand-ink)]/50"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
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
          className="agent-press mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-emerald) 0%, var(--brand-emerald-soft) 100%)",
            boxShadow:
              "0 10px 24px -8px color-mix(in srgb, var(--brand-emerald) 60%, transparent)",
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

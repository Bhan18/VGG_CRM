"use client";

// Sign-in screen — employee code + 4-digit MPIN (numeric input).

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";
import { useBranding } from "@/hooks/agent/use-branding";
import { Loader2, Fingerprint } from "lucide-react";
import { BrandLogo } from "./brand-logo";

const MPIN_LENGTH = 4;

export function AgentSignIn() {
  const { signIn } = useAgentAuth();
  const { branding } = useBranding();
  const [employeeCode, setEmployeeCode] = useState("");
  const [mpin, setMpin] = useState<string[]>(Array(MPIN_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first MPIN box
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleMpinChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return; // digits only
      const digit = value.slice(-1); // take last typed digit
      const next = [...mpin];
      next[index] = digit;
      setMpin(next);
      setError(null);

      // Auto-advance
      if (digit && index < MPIN_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all 4 digits entered
      if (digit && index === MPIN_LENGTH - 1) {
        const fullMpin = next.join("");
        if (fullMpin.length === MPIN_LENGTH && employeeCode.trim()) {
          void submitMpin(employeeCode.trim(), fullMpin);
        }
      }
    },
    [mpin, employeeCode],
  );

  const handleMpinKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !mpin[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [mpin],
  );

  const handleMpinPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, MPIN_LENGTH);
      if (!text) return;
      const next = [...mpin];
      for (let i = 0; i < text.length && i < MPIN_LENGTH; i++) {
        next[i] = text[i]!;
      }
      setMpin(next);
      const focusIdx = Math.min(text.length, MPIN_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();

      // Auto-submit if full MPIN pasted
      if (text.length === MPIN_LENGTH && employeeCode.trim()) {
        void submitMpin(employeeCode.trim(), text);
      }
    },
    [mpin, employeeCode],
  );

  async function submitMpin(code: string, pin: string) {
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await signIn(code, pin);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Sign-in failed.");
      setMpin(Array(MPIN_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullMpin = mpin.join("");
    if (!employeeCode.trim()) {
      setError("Enter your employee code.");
      return;
    }
    if (fullMpin.length !== MPIN_LENGTH) {
      setError("Enter your 4-digit MPIN.");
      return;
    }
    await submitMpin(employeeCode.trim(), fullMpin);
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
        {/* Employee code */}
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
              onChange={(e) => {
                setEmployeeCode(e.target.value);
                setError(null);
              }}
              disabled={busy}
              className="w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white pl-10 pr-3 py-3 text-sm outline-none focus:border-[var(--brand-emerald)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-emerald)_20%,transparent)]"
              placeholder="e.g. EMP001"
            />
          </div>
        </div>

        {/* MPIN */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--brand-ink)]/70">
            MPIN
          </label>
          <div className="flex items-center justify-center gap-3">
            {mpin.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleMpinChange(i, e.target.value)}
                onKeyDown={(e) => handleMpinKeyDown(i, e)}
                onPaste={i === 0 ? handleMpinPaste : undefined}
                disabled={busy}
                className="h-14 w-14 rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white text-center text-xl font-semibold outline-none focus:border-[var(--brand-emerald)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-emerald)_20%,transparent)] disabled:opacity-60"
                aria-label={`MPIN digit ${i + 1}`}
              />
            ))}
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
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

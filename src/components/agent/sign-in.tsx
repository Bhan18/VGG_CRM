"use client";

// Sign-in screen.
// If a previous employee code is stored (localStorage), shows MPIN-only
// input directly — no employee code field, no password fallback.
// Otherwise shows employee code + password form.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";
import { useBranding } from "@/hooks/agent/use-branding";
import { Loader2, Eye, EyeOff, Lock, Fingerprint, KeyRound, LogOut } from "lucide-react";
import { BrandLogo } from "./brand-logo";

const MPIN_LENGTH = 4;
const STORAGE_KEY = "attendance-last-employee-code";

export function AgentSignIn() {
  const { signIn } = useAgentAuth();
  const { branding } = useBranding();
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MPIN state
  const [mpinAvailable, setMpinAvailable] = useState<boolean | null>(null);
  const [useMpin, setUseMpin] = useState(false);
  const [mpin, setMpin] = useState<string[]>(Array(MPIN_LENGTH).fill(""));
  const mpinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Quick-login mode: stored employee code + MPIN only
  const [quickLogin, setQuickLogin] = useState(false);
  const [storedCode, setStoredCode] = useState<string | null>(null);

  // On mount, check for stored employee code
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setStoredCode(saved);
        setEmployeeCode(saved);
        setQuickLogin(true);
        // Auto-check MPIN availability
        fetch(`/api/attendance/staff/check-mpin?code=${encodeURIComponent(saved)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.hasMpin) {
              setMpinAvailable(true);
              setUseMpin(true);
            } else {
              // No MPIN set — fall back to normal login
              setQuickLogin(false);
              setStoredCode(null);
              setMpinAvailable(false);
            }
          })
          .catch(() => {
            setQuickLogin(false);
            setStoredCode(null);
          });
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Focus first MPIN box when quick-login mode is ready
  useEffect(() => {
    if (quickLogin && useMpin) {
      setTimeout(() => mpinRefs.current[0]?.focus(), 100);
    }
  }, [quickLogin, useMpin]);

  // When employee code changes (normal mode), check MPIN
  useEffect(() => {
    if (quickLogin) return;
    if (!employeeCode.trim()) {
      setMpinAvailable(null);
      setUseMpin(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/attendance/staff/check-mpin?code=${encodeURIComponent(employeeCode.trim())}`);
        const data = await res.json().catch(() => ({ hasMpin: false }));
        setMpinAvailable(data.hasMpin);
        setUseMpin(data.hasMpin);
        setMpin(Array(MPIN_LENGTH).fill(""));
        setError(null);
      } catch {
        setMpinAvailable(false);
        setUseMpin(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [employeeCode, quickLogin]);

  // Focus first MPIN box when switching to MPIN mode (normal flow)
  useEffect(() => {
    if (!quickLogin && useMpin) {
      mpinRefs.current[0]?.focus();
    }
  }, [useMpin, quickLogin]);

  // --- MPIN handlers ---

  const handleMpinChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;
      const digit = value.slice(-1);
      const next = [...mpin];
      next[index] = digit;
      setMpin(next);
      setError(null);
      if (digit && index < MPIN_LENGTH - 1) {
        mpinRefs.current[index + 1]?.focus();
      }
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
        mpinRefs.current[index - 1]?.focus();
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
      mpinRefs.current[focusIdx]?.focus();
      if (text.length === MPIN_LENGTH && employeeCode.trim()) {
        void submitMpin(employeeCode.trim(), text);
      }
    },
    [mpin, employeeCode],
  );

  // --- Submit ---

  async function submitMpin(code: string, pin: string) {
    if (busy) return;
    setError(null);
    setBusy(true);
    // Store employee code for next quick login
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
    const res = await signIn(code, pin);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Sign-in failed.");
      setMpin(Array(MPIN_LENGTH).fill(""));
      mpinRefs.current[0]?.focus();
    }
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!employeeCode.trim() || !password) {
      setError("Enter your employee code and password.");
      return;
    }
    setBusy(true);
    // Store employee code for next quick login
    try { localStorage.setItem(STORAGE_KEY, employeeCode.trim()); } catch { /* ignore */ }
    const res = await signIn(employeeCode.trim(), password);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Sign-in failed.");
  }

  async function onSubmitMpin(e: React.FormEvent) {
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

  function switchToNormalLogin() {
    setQuickLogin(false);
    setStoredCode(null);
    setEmployeeCode("");
    setPassword("");
    setMpin(Array(MPIN_LENGTH).fill(""));
    setMpinAvailable(null);
    setUseMpin(false);
    setError(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
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

      {/* ── Quick-login: MPIN only ─────────────────────────── */}
      {quickLogin && useMpin && mpinAvailable && (
        <div className="flex-1 -mt-6 rounded-t-3xl bg-[var(--brand-paper)] px-6 pt-8 pb-8 flex flex-col gap-5">
          <div className="text-center">
            <div className="text-sm font-semibold">Welcome back</div>
            <div className="mt-1 text-xs text-[var(--brand-ink)]/50">
              Enter your MPIN to sign in
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--brand-emerald)]">
              {storedCode}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">MPIN</label>
            <div className="flex items-center justify-center gap-3">
              {mpin.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { mpinRefs.current[i] = el; }}
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
            type="button"
            onClick={() => {
              const fullMpin = mpin.join("");
              if (fullMpin.length === MPIN_LENGTH && employeeCode.trim()) {
                void submitMpin(employeeCode.trim(), fullMpin);
              }
            }}
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
            {busy ? "Signing in..." : "Sign in with MPIN"}
          </button>

          <button
            type="button"
            onClick={switchToNormalLogin}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--brand-ink)]/45 hover:text-[var(--brand-ink)]/65"
          >
            <LogOut className="h-3 w-3" />
            Sign in with a different account
          </button>
        </div>
      )}

      {/* ── Normal login: employee code + password/MPIN ────── */}
      {(!quickLogin || !useMpin || !mpinAvailable) && (
        <form
          onSubmit={useMpin ? onSubmitMpin : onSubmitPassword}
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

          {/* MPIN input (normal mode) */}
          {!quickLogin && useMpin && mpinAvailable && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--brand-ink)]/70">MPIN</label>
              <div className="flex items-center justify-center gap-3">
                {mpin.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { mpinRefs.current[i] = el; }}
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
          )}

          {/* Password input */}
          {(!useMpin || !mpinAvailable) && (
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
                  placeholder="Enter password"
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
          )}

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
            {busy ? "Signing in..." : useMpin ? "Sign in with MPIN" : "Sign in"}
          </button>

          {/* Toggle between MPIN and password */}
          {mpinAvailable !== null && employeeCode.trim() && (
            <button
              type="button"
              onClick={() => {
                setUseMpin((v) => !v);
                setError(null);
                setMpin(Array(MPIN_LENGTH).fill(""));
                setPassword("");
              }}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--brand-emerald)] hover:underline"
            >
              {useMpin ? (
                <>
                  <Lock className="h-3 w-3" />
                  Use password instead
                </>
              ) : (
                <>
                  <KeyRound className="h-3 w-3" />
                  Use MPIN instead
                </>
              )}
            </button>
          )}
        </form>
      )}
    </div>
  );
}

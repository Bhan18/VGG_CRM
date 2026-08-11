"use client";

// Agent auth provider — employee code + password against the attendance
// Supabase project. The server issues an httpOnly cookie
// (attendance-staff-session); the client never stores a token. Session
// validity is re-checked against /api/attendance/staff/session on boot.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AgentSession } from "@/lib/agent/types";

interface AgentAuthContextValue {
  session: AgentSession | null;
  loading: boolean;
  signIn: (
    employeeCode: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AgentAuthContext = createContext<AgentAuthContextValue | null>(null);

async function fetchSession(): Promise<AgentSession | null> {
  const res = await fetch("/api/attendance/staff/session", {
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.employee) return null;
  return data as AgentSession;
}

export function AgentAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const next = await fetchSession();
    setSession(next);
    return undefined;
  }, []);

  // Validate the staff cookie on first mount.
  useEffect(() => {
    let active = true;
    (async () => {
      const next = await fetchSession();
      if (active) {
        setSession(next);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(
    async (employeeCode: string, password: string) => {
      if (!employeeCode.trim() || !password) {
        return { ok: false, error: "Enter your employee code and password." };
      }
      try {
        const res = await fetch("/api/attendance/staff/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeCode, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: data?.error ?? "Sign-in failed." };
        }
        const next = await fetchSession();
        setSession(next);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/attendance/staff/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    setSession(null);
    router.replace("/agent");
  }, [router]);

  const value = useMemo<AgentAuthContextValue>(
    () => ({ session, loading, signIn, signOut, refreshSession }),
    [session, loading, signIn, signOut, refreshSession],
  );

  return (
    <AgentAuthContext.Provider value={value}>
      {children}
    </AgentAuthContext.Provider>
  );
}

export function useAgentAuth() {
  const ctx = useContext(AgentAuthContext);
  if (!ctx) throw new Error("useAgentAuth must be used inside <AgentAuthProvider>.");
  return ctx;
}

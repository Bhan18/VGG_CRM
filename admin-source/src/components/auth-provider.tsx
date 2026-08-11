
"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";
import { getPermissions, type Permissions } from "@/lib/permissions";
import { useCrm } from "@/lib/store";
import type { UserRole } from "@/lib/types";

interface AuthUser extends User {
  role?: UserRole;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  permissions: Permissions | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { loadFromSupabase } = useCrm();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadFromSupabase]);

  // ---- Client-side auto-backup fallback ----
  // If Vercel Cron isn't set up (or hasn't run), check on app load whether a backup
  // is due (>24h since last backup). If so, trigger one in the background.
  // This ensures auto-backup works even on the Supabase free tier without external cron.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // Only check once per browser session (avoid hammering the API on every navigation)
        const sessionKey = "vgg-crm-autobackup-checked";
        if (typeof window !== "undefined" && sessionStorage.getItem(sessionKey)) return;
        if (typeof window !== "undefined") sessionStorage.setItem(sessionKey, "1");
        // Hit the cron endpoint — it checks internally whether a backup is due
        const res = await fetch("/api/backup/cron");
        if (!res.ok) return;
        const data = await res.json();
        // If a backup was created, reload CRM data so the UI is fresh
        if (data?.backup?.id && !cancelled) {
          console.info("[auto-backup] Backup created:", data.backup.id);
        }
      } catch {
        // Silent fail — auto-backup is best-effort
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function fetchUserProfile(authUser: User) {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("name, role, active")
        .eq("id", authUser.id)
        .single();

      if (error) throw error;

      if (data && data.active) {
        setUser({ ...authUser, name: data.name, role: data.role as UserRole });
        // Load ALL CRM data from Supabase when user logs in
        loadFromSupabase();
      } else if (data && !data.active) {
        await supabase.auth.signOut();
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  const permissions = user?.role ? getPermissions(user.role) : null;

  return (
    <AuthContext.Provider value={{ user, session, permissions, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}



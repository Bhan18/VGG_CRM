
"use client";

import { useState, createContext, useContext, type ReactNode } from "react";
import { validateLogin, getPermissions, type LoginUser, type Permissions } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

interface AuthState {
  user: LoginUser | null;
  permissions: Permissions | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = "vgg-crm-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginUser | null>(null);

  // Restore session from sessionStorage on mount (lazy init, not in effect)
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as LoginUser;
          setUser(parsed);
        } catch {
          // ignore
        }
      }
    }
  }

  const login = (email: string, password: string): boolean => {
    const found = validateLogin(email, password);
    if (found) {
      setUser(found);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const permissions = user ? getPermissions(user.role) : null;

  return (
    <AuthContext.Provider value={{ user, permissions, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}



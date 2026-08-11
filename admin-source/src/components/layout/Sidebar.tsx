
"use client";

import { navItems, navSectionTitles, sectionOrder } from "@/lib/nav";
import type { NavItem, RouteKey } from "@/lib/nav";
import type { User, CompanySettings } from "@/lib/types";
import type { Permissions } from "@/lib/permissions";
import { Building2, ChevronDown, LogOut } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

interface SidebarProps {
  currentRoute: RouteKey;
  onNavigate: (route: RouteKey, ctx?: { selectedProjectId?: string; selectedLayoutId?: string; selectedPlotId?: string }) => void;
  settings: CompanySettings | null;
  user: User | null;
  onSignOut: () => void;
  permissions?: Permissions;
}

const COLLAPSE_STORAGE_KEY = "vgg-sidebar-collapsed-sections";

export default function Sidebar({ currentRoute, onNavigate, settings, user, onSignOut, permissions }: SidebarProps) {
  const grouped = useMemo(() => {
    const m: Record<string, NavItem[]> = {};
    for (const item of navItems) {
      if (permissions && !permissions.canView.includes(item.route)) continue;
      (m[item.section] ||= []).push(item);
    }
    return m;
  }, [permissions]);

  // ---- Collapsible sections state ----
  // "main" is ALWAYS expanded. All other sections are collapsible.
  // Persisted in localStorage. Auto-expanded if the active route is inside.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (stored) setCollapsed(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  // Persist collapsed state
  const toggleSection = (section: string) => {
    if (section === "main") return; // main is always expanded
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      if (typeof window !== "undefined") {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  // Find which section the current route belongs to → auto-expand it
  const activeSection = useMemo(() => {
    for (const item of navItems) {
      if (item.route === currentRoute) return item.section;
    }
    return null;
  }, [currentRoute]);

  // If active section is collapsed, expand it (without persisting — just visual)
  const isSectionExpanded = (section: string) => {
    if (section === "main") return true; // always expanded
    if (section === activeSection) return true; // auto-expand active section
    return !collapsed.has(section);
  };

  return (
    <aside className="w-[256px] shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col sticky top-0 h-screen z-30">
      {/* Brand — Premium glassmorphic header */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border glass">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold text-sm shrink-0 shadow-lg transition-transform hover:scale-105">
          {settings?.companyLogo ? (
            <img src={settings.companyLogo} alt="logo" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <Building2 className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-tight truncate">{settings?.companyName ?? "VGG Infra Developers"}</div>
          <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">CRM Suite</div>
        </div>
      </div>

      {/* Nav — Smooth scrolling with stagger animations */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 sidebar-scroll">
        {sectionOrder.map((section, sIdx) => {
          const items = grouped[section];
          if (!items || items.length === 0) return null; // hide empty sections

          const isMain = section === "main";
          const expanded = isSectionExpanded(section);
          const isActiveSection = section === activeSection;

          return (
            <div key={section} className={`view-enter stagger-${Math.min(sIdx + 1, 5)}`}>
              {/* Section header — clickable for non-main sections */}
              {isMain ? (
                <div className="px-2 mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {navSectionTitles[section]}
                </div>
              ) : (
                <button
                  onClick={() => toggleSection(section)}
                  className={`w-full flex items-center justify-between px-2 mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    isActiveSection ? "text-sidebar-primary" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
                  }`}
                >
                  <span>{navSectionTitles[section]}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
                  />
                </button>
              )}

              {/* Section items — collapsible */}
              <div
                className={`space-y-0.5 overflow-hidden transition-all duration-200 ${
                  expanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = currentRoute === item.route;
                  return (
                    <button
                      key={item.route}
                      onClick={() => onNavigate(item.route)}
                      className={`nav-link w-full ${active ? "active" : ""}`}
                      title={item.label}
                    >
                      <Icon className="w-[18px] h-[18px] nav-icon shrink-0 transition-transform group-hover:scale-110" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer — Premium glassmorphic */}
      <div className="border-t border-sidebar-border p-3 glass">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-accent text-sidebar-primary-foreground grid place-items-center text-xs font-bold shadow-md transition-transform hover:scale-105">
            {user?.name?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{user?.name}</div>
            <div className="text-[10px] text-sidebar-foreground/60 capitalize">{user?.role?.replace("_", " ")}</div>
          </div>
          <button
            onClick={onSignOut}
            className="w-7 h-7 grid place-items-center rounded text-sidebar-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

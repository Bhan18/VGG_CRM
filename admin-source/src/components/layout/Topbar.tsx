
"use client";

import { useSupabaseData } from "@/hooks/use-supabase-data";
import type { RouteKey, CompanySettings, User } from "@/lib/types";
import {
  Search, Bell, Sun, Moon, ChevronDown, Calendar, AlertTriangle,
  CheckCircle2, Banknote, LogOut,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { formatDate, relativeTime } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface DataState {
  plots: import("@/lib/types").Plot[];
  customers: import("@/lib/types").Customer[];
  bookings: import("@/lib/types").Booking[];
  sales: import("@/lib/types").Sale[];
  payments: import("@/lib/types").Payment[];
}

interface TopbarProps {
  currentRoute: RouteKey;
  data: DataState;
  onNavigate: (route: RouteKey, ctx?: { selectedProjectId?: string; selectedLayoutId?: string; selectedPlotId?: string }) => void;
  user: User | null;
  onSignOut: () => void;
}

const roleLabels: Record<string, string> = {
  administrator: "Administrator",
  sales_manager: "Sales Manager",
  marketing: "Marketing",
  viewer: "Viewer",
};

export default function Topbar({ currentRoute, data, onNavigate, user, onSignOut }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Real-time clock — updates every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { plots, customers, bookings, sales } = data;

  // Build derived notifications
  const notifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    const list: {
      id: string; type: string; title: string; description: string;
      timestamp: string; icon: typeof Bell; color: string; route?: RouteKey;
    }[] = [];

    sales
      .filter((s) => new Date(s.saleDate) >= new Date(Date.now() - 7 * 86400000))
      .slice(0, 3)
      .forEach((s) => {
        const plot = plots.find((p) => p.id === s.plotId);
        const cust = customers.find((c) => c.id === s.customerId);
        list.push({
          id: `sold-${s.id}`, type: "recently_sold",
          title: `Sale recorded: ${plot?.plotNumber ?? "Plot"}`,
          description: `${cust?.name ?? "Customer"} · ₹${s.saleAmount.toLocaleString("en-IN")}`,
          timestamp: s.saleDate, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50",
          route: "sold-plots",
        });
      });

    bookings
      .filter((b) => {
        if (!b.bookingExpiry) return false;
        const d = new Date(b.bookingExpiry);
        return d >= today && d <= in7Days;
      })
      .slice(0, 5)
      .forEach((b) => {
        const plot = plots.find((p) => p.id === b.plotId);
        list.push({
          id: `exp-${b.id}`, type: "booking_expiring",
          title: `Booking expiring: ${plot?.plotNumber ?? "Plot"}`,
          description: `Expiry ${formatDate(b.bookingExpiry)}`,
          timestamp: b.bookingExpiry!, icon: AlertTriangle, color: "text-amber-600 bg-amber-50",
          route: "bookings",
        });
      });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 12);
  }, [sales, bookings, plots, customers]);

  // Global search
  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results: { type: string; label: string; sub: string; route: RouteKey; id: string }[] = [];

    plots.forEach((p) => {
      if (
        p.plotNumber.toLowerCase().includes(q) ||
        p.block.toLowerCase().includes(q) ||
        String(p.size).includes(q)
      ) {
        results.push({
          type: "Plot", label: `Plot ${p.plotNumber}`,
          sub: `Block ${p.block} · ${p.size} ${p.sizeUnit} · ${p.status}`,
          route: "interactive-layout", id: p.id,
        });
      }
    });

    customers.forEach((c) => {
      if (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.aadhaar ?? "").includes(q) ||
        (c.pan ?? "").toLowerCase().includes(q)
      ) {
        results.push({
          type: "Customer", label: c.name,
          sub: `${c.phone} · ${c.city ?? ""}`,
          route: "customers", id: c.id,
        });
      }
    });

    sales.forEach((s) => {
      if ((s.registrationNumber ?? "").toLowerCase().includes(q) || (s.referenceCode ?? "").toLowerCase().includes(q)) {
        const plot = plots.find((p) => p.id === s.plotId);
        results.push({
          type: "Sale", label: `Ref: ${s.referenceCode ?? s.registrationNumber}`,
          sub: `${plot?.plotNumber ?? ""} · ₹${s.saleAmount.toLocaleString("en-IN")}`,
          route: "sales", id: s.id,
        });
      }
    });

    return results.slice(0, 8);
  }, [globalSearch, plots, customers, sales]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pageTitleMap: Record<RouteKey, string> = {
    dashboard: "Dashboard", projects: "Projects", layouts: "Layouts",
    "interactive-layout": "Interactive Layout", customers: "Customers",
    bookings: "Bookings", sales: "Sales", payments: "Payments", discounts: "Discounts",
    "marketing-team": "Marketing Team", "website-content": "Website Content",
    "vacant-plots": "Vacant Plots", "booked-plots": "Booked Plots",
    "reserved-plots": "Reserved Plots",
    "sold-plots": "Sold Plots", "all-plots": "All Plots",
    "generate-agreement":"Generate Agreement",
    reports: "Reports", analytics: "Analytics",
    users: "Users & Roles", settings: "Settings",
    // Attendance module
    "att-overview": "Attendance Overview",
    "att-today": "Today's Attendance",
    "att-employees": "Attendance Employees",
    "att-history": "Attendance History",
    "att-reports": "Attendance Reports",
    "att-locations": "Attendance Locations",
    "att-settings": "Attendance Settings",
    "att-audit": "Attendance Audit Logs",
    "att-salary": "Salary Management",
    "att-resources": "Company Resources",
  };

  return (
    <header className="h-16 glass border-b border-border sticky top-0 z-20 flex items-center px-4 lg:px-6 gap-3">
      <div className="hidden md:block fade-in">
        <h1 className="text-lg font-bold tracking-tight">{pageTitleMap[currentRoute]}</h1>
        <div className="text-xs text-muted-foreground tabular-nums">
          {currentTime.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>

      <div ref={searchRef} className="flex-1 max-w-xl mx-auto relative">
        <div className="relative group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            value={globalSearch}
            onChange={(e) => { setGlobalSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder="Search plot, customer, phone, Aadhaar, reference code..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/40 rounded-xl border border-transparent focus:border-primary/30 focus:bg-background focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200"
          />
        </div>
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full mt-1.5 left-0 right-0 glass border border-border rounded-xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto scale-in">
            {searchResults.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => {
                  if (r.type === "Plot") {
                    const plot = plots.find((p) => p.id === r.id);
                    onNavigate("interactive-layout", {
                      selectedProjectId: plot?.projectId,
                      selectedLayoutId: plot?.layoutId,
                      selectedPlotId: r.id,
                    });
                  } else {
                    onNavigate(r.route);
                  }
                  setGlobalSearch(""); setShowResults(false);
                }}
                className="w-full px-3 py-2.5 text-left hover:bg-primary/5 flex items-center justify-between gap-3 border-b border-border/50 last:border-b-0 transition-colors duration-150"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.sub}</div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{r.type}</Badge>
              </button>
            ))}
          </div>
        )}
        {showResults && globalSearch && searchResults.length === 0 && (
          <div className="absolute top-full mt-1.5 left-0 right-0 glass border border-border rounded-xl shadow-2xl p-4 text-sm text-muted-foreground z-50 scale-in">
            No matches for &ldquo;{globalSearch}&rdquo;
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative w-10 h-10 grid place-items-center rounded-lg hover:bg-muted transition">
              <Bell className="w-[18px] h-[18px]" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-semibold grid place-items-center">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="font-semibold text-sm">Notifications</div>
              <Badge variant="secondary" className="text-[10px]">{notifications.length} new</Badge>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.map((n) => {
                  const Icon = n.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => n.route && onNavigate(n.route)}
                      className="w-full p-3 border-b border-border last:border-b-0 hover:bg-muted/60 flex items-start gap-3 text-left transition"
                    >
                      <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${n.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{n.description}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">{relativeTime(n.timestamp)}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-10 h-10 grid place-items-center rounded-lg hover:bg-muted transition"
          title="Toggle theme"
        >
          {mounted && theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg hover:bg-muted transition">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
                  {user?.name?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold leading-tight">{user?.name}</div>
                <div className="text-[10px] text-muted-foreground">{roleLabels[user?.role ?? "viewer"]}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate("settings")}>Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut} className="text-rose-600 focus:text-rose-700">
              <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}



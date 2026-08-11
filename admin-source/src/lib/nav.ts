
// Navigation config — single source of truth for sidebar links
import {
  LayoutDashboard,
  FileText,
  Building2,
  Map,
  MousePointerClick,
  Users,
  CalendarCheck,
  Banknote,
  Wallet,
  CircleCheck,
  Lock,
  TrendingUp,
  FileBarChart,
  Settings,
  UserCog,
  Bookmark,
  BookMarked,
  LayoutGrid,
  Tag,
  BadgeIndianRupee,
  Globe,
  CalendarDays,
  History,
  MapPin,
  ScrollText,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import type { RouteKey } from "@/lib/types";
export type { RouteKey } from "@/lib/types";

export interface NavItem {
  route: RouteKey;
  label: string;
  icon: LucideIcon;
  section: "main" | "plots" | "transactions" | "marketing" | "others" | "insights" | "attendance" | "admin";
}

export const navItems: NavItem[] = [
  { route: "dashboard", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { route: "projects", label: "Projects", icon: Building2, section: "main" },
  { route: "layouts", label: "Layouts", icon: Map, section: "main" },
  { route: "interactive-layout", label: "Interactive Layout", icon: MousePointerClick, section: "main" },
  { route: "customers", label: "Customers", icon: Users, section: "transactions" },
  { route: "bookings", label: "Bookings", icon: CalendarCheck, section: "transactions" },
  { route: "sales", label: "Sales", icon: Banknote, section: "transactions" },
  { route: "payments", label: "Payments", icon: Wallet, section: "transactions" },
  { route: "discounts", label: "Discounts", icon: Tag, section: "transactions" },
  { route: "marketing-team", label: "Marketing Team", icon: BadgeIndianRupee, section: "marketing" },
  { route: "website-content", label: "Website Content", icon: Globe, section: "others" },
  { route: "generate-agreement", label: "Generate Agreement", icon: FileText, section: "others" },
  { route: "all-plots", label: "All Plots", icon: LayoutGrid, section: "plots" },
  { route: "vacant-plots", label: "Vacant Plots", icon: CircleCheck, section: "plots" },
  { route: "booked-plots", label: "Booked Plots", icon: Bookmark, section: "plots" },
  { route: "reserved-plots", label: "Reserved Plots", icon: BookMarked, section: "plots" },
  { route: "sold-plots", label: "Sold Plots", icon: TrendingUp, section: "plots" },
  { route: "reports", label: "Reports", icon: FileBarChart, section: "insights" },
  { route: "analytics", label: "Analytics", icon: TrendingUp, section: "insights" },
  // ---- Attendance module (Supabase 2 — isolated) ----
  { route: "att-overview", label: "Overview", icon: LayoutDashboard, section: "attendance" },
  { route: "att-today", label: "Today's Attendance", icon: CalendarCheck, section: "attendance" },
  { route: "att-employees", label: "Employees", icon: Users, section: "attendance" },
  { route: "att-history", label: "Attendance History", icon: History, section: "attendance" },
  { route: "att-reports", label: "Reports", icon: FileBarChart, section: "attendance" },
  { route: "att-locations", label: "Locations", icon: MapPin, section: "attendance" },
  { route: "att-settings", label: "Attendance Settings", icon: Settings, section: "attendance" },
  { route: "att-audit", label: "Audit Logs", icon: ScrollText, section: "attendance" },
  { route: "att-salary", label: "Salary Management", icon: DollarSign, section: "attendance" },
  { route: "att-resources", label: "Company Resources", icon: FileText, section: "attendance" },
  { route: "users", label: "Users & Roles", icon: UserCog, section: "admin" },
  { route: "settings", label: "Settings", icon: Settings, section: "admin" },
];

// Section order — attendance comes AFTER insights, BEFORE admin
export const sectionOrder: NavItem["section"][] = [
  "main", "plots", "transactions", "marketing", "others", "insights", "attendance", "admin",
];

export const navSectionTitles: Record<NavItem["section"], string> = {
  main: "Main",
  plots: "Plot Inventory",
  transactions: "Sales & Finance",
  marketing: "Marketing & Sales",
  insights: "Insights",
  others: "Others",
  attendance: "Staff Attendance",
  admin: "Administration",
};

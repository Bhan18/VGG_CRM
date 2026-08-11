
// ============================================================
// Role-based permissions for VGG CRM
// ============================================================
import type { UserRole, RouteKey } from "./types";

export interface Permissions {
  // View access
  canView: RouteKey[];
  // Edit access
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canCreateLayouts: boolean;
  canEditLayouts: boolean;
  canDeleteLayouts: boolean;
  canEditPlots: boolean;
  canChangePlotStatus: boolean;
  canCreateBookings: boolean;
  canCreateSales: boolean;
  canRecordPayments: boolean;
  canCreateCustomers: boolean;
  canEditCustomers: boolean;
  canDeleteCustomers: boolean;
  canExport: boolean;
  canManageUsers: boolean;
  canEditSettings: boolean;
  canDeleteData: boolean;
}

export const rolePermissions: Record<UserRole, Permissions> = {
  // Administrator — full access to everything
  administrator: {
    canView: ["dashboard", "projects", "layouts", "interactive-layout", "customers", "bookings", "sales", "payments", "discounts", "marketing-team", "website-content", "generate-agreement", "vacant-plots", "booked-plots", "reserved-plots", "sold-plots", "all-plots", "reports", "analytics", "users", "settings", "att-overview", "att-today", "att-employees", "att-history", "att-reports", "att-locations", "att-settings", "att-audit", "att-salary", "att-resources"],
    canCreateProjects: true,
    canEditProjects: true,
    canDeleteProjects: true,
    canCreateLayouts: true,
    canEditLayouts: true,
    canDeleteLayouts: true,
    canEditPlots: true,
    canChangePlotStatus: true,
    canCreateBookings: true,
    canCreateSales: true,
    canRecordPayments: true,
    canCreateCustomers: true,
    canEditCustomers: true,
    canDeleteCustomers: true,
    canExport: true,
    canManageUsers: true,
    canEditSettings: true,
    canDeleteData: true,
  },
  // Sales Manager — add/edit customers only, view all, export all, access reports & analytics
  // Attendance: view-only (no admin mutations)
  sales_manager: {
    canView: ["dashboard", "projects", "layouts", "interactive-layout", "customers", "bookings", "sales", "payments", "discounts", "marketing-team", "website-content", "generate-agreement", "vacant-plots", "booked-plots", "reserved-plots", "sold-plots", "all-plots", "reports", "analytics", "att-overview", "att-today", "att-history", "att-reports"],
    canCreateProjects: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canCreateLayouts: false,
    canEditLayouts: false,
    canDeleteLayouts: false,
    canEditPlots: false,
    canChangePlotStatus: false,
    canCreateBookings: false,
    canCreateSales: false,
    canRecordPayments: false,
    canCreateCustomers: true,
    canEditCustomers: true,
    canDeleteCustomers: false,
    canExport: true,
    canManageUsers: false,
    canEditSettings: false,
    canDeleteData: false,
  },
  // Marketing — view all, export all, access reports & analytics, no editing
  // Attendance: view-only (overview + today)
  marketing: {
    canView: ["dashboard", "projects", "layouts", "interactive-layout", "customers", "bookings", "sales", "payments", "discounts", "marketing-team", "website-content", "vacant-plots", "booked-plots", "reserved-plots", "sold-plots", "all-plots", "reports", "analytics", "att-overview", "att-today"],
    canCreateProjects: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canCreateLayouts: false,
    canEditLayouts: false,
    canDeleteLayouts: false,
    canEditPlots: false,
    canChangePlotStatus: false,
    canCreateBookings: false,
    canCreateSales: false,
    canRecordPayments: false,
    canCreateCustomers: false,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canExport: true,
    canManageUsers: false,
    canEditSettings: false,
    canDeleteData: false,
  },
  // Viewer — view only, no edit buttons, no export buttons visible
  // Attendance: view-only (overview + today)
  viewer: {
    canView: ["dashboard", "projects", "layouts", "interactive-layout", "customers", "bookings", "sales", "payments", "discounts", "marketing-team", "website-content", "vacant-plots", "booked-plots", "reserved-plots", "sold-plots", "all-plots", "reports", "analytics", "att-overview", "att-today"],
    canCreateProjects: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canCreateLayouts: false,
    canEditLayouts: false,
    canDeleteLayouts: false,
    canEditPlots: false,
    canChangePlotStatus: false,
    canCreateBookings: false,
    canCreateSales: false,
    canRecordPayments: false,
    canCreateCustomers: false,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canExport: false,
    canManageUsers: false,
    canEditSettings: false,
    canDeleteData: false,
  },
};

// Hardcoded login credentials (no Supabase — simple demo auth)
export interface LoginUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export const hardcodedUsers: LoginUser[] = [
  { id: "u1", name: "Venkatesh G", email: "admin@vgginfra.com", password: "admin123", role: "administrator" },
  { id: "u2", name: "Priya Sharma", email: "priya@vgginfra.com", password: "sales123", role: "sales_manager" },
  { id: "u3", name: "Arjun Reddy", email: "arjun@vgginfra.com", password: "market123", role: "marketing" },
  { id: "u4", name: "Meena Iyer", email: "meena@vgginfra.com", password: "view123", role: "viewer" },
];

export function validateLogin(email: string, password: string): LoginUser | null {
  const user = hardcodedUsers.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
  );
  return user ?? null;
}

export function getPermissions(role: UserRole): Permissions {
  return rolePermissions[role];
}



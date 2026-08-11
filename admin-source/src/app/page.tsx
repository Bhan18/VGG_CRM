
"use client";

import { useAuth } from "@/components/auth-provider";
import { useCrm } from "@/lib/store";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import WebsiteContentPage from "@/components/pages/WebsiteContentPage";
import DashboardPage from "@/components/pages/DashboardPage";
import ProjectsPage from "@/components/pages/ProjectsPage";
import LayoutsPage from "@/components/pages/LayoutsPage";
import InteractiveLayoutPage from "@/components/pages/InteractiveLayoutPage";
import CustomersPage from "@/components/pages/CustomersPage";
import BookingsPage from "@/components/pages/BookingsPage";
import SalesPage from "@/components/pages/SalesPage";
import PaymentsPage from "@/components/pages/PaymentsPage";
import PlotListPage from "@/components/pages/PlotListPage";
import ReportsPage from "@/components/pages/ReportsPage";
import AnalyticsPage from "@/components/pages/AnalyticsPage";
import UsersPage from "@/components/pages/UsersPage";
import SettingsPage from "@/components/pages/SettingsPage";
import GenerateAgreementPage from "@/components/pages/GenerateAgreementPage";
import DiscountsPage from "@/components/pages/DiscountsPage";
import MarketingTeamPage from "@/components/pages/MarketingTeamPage";
import LoginPage from "@/components/pages/LoginPage";
// Attendance module (Supabase 2 — isolated)
import { OverviewView } from "@/components/attendance/OverviewView";
import { TodayView } from "@/components/attendance/TodayView";
import { EmployeesView } from "@/components/attendance/EmployeesView";
import { HistoryView } from "@/components/attendance/HistoryView";
import { ReportsView as AttReportsView } from "@/components/attendance/ReportsView";
import { LocationsView } from "@/components/attendance/LocationsView";
import { SettingsView as AttSettingsView } from "@/components/attendance/SettingsView";
import { AuditView } from "@/components/attendance/AuditView";
import { SalaryView } from "@/components/attendance/SalaryView";
import { ResourcesView } from "@/components/attendance/ResourcesView";
import type { RouteKey, User } from "@/lib/types";
import { Shield, Building2 } from "lucide-react";

export default function Home() {
  const { user, permissions, loading, signOut } = useAuth();
  const currentRoute = useCrm((s) => s.currentRoute);
  const setRoute = useCrm((s) => s.setRoute);
  const selectedProjectId = useCrm((s) => s.selectedProjectId);
  const selectedLayoutId = useCrm((s) => s.selectedLayoutId);
  const selectedPlotId = useCrm((s) => s.selectedPlotId);
  const settings = useCrm((s) => s.settings);
  const plots = useCrm((s) => s.plots);
  const customers = useCrm((s) => s.customers);
  const bookings = useCrm((s) => s.bookings);
  const sales = useCrm((s) => s.sales);
  const payments = useCrm((s) => s.payments);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background gradient-animated">
        <div className="flex flex-col items-center gap-4 fade-in">
          <div className="w-12 h-12 rounded-xl bg-primary grid place-items-center shadow-lg animate-pulse">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="spinner-premium" />
            Loading VGG CRM…
          </div>
        </div>
      </div>
    );
  }

  if (!user || !permissions) {
    return <LoginPage />;
  }

  const appUser: User = {
    id: user.id,
    name: (user as { name?: string }).name ?? user.email ?? "User",
    email: user.email ?? "",
    role: (user as { role?: import("@/lib/types").UserRole }).role ?? "viewer",
    active: true,
    createdAt: new Date().toISOString(),
  };

  const handleNavigate = (
    r: RouteKey,
    ctx?: { selectedProjectId?: string; selectedLayoutId?: string; selectedPlotId?: string },
  ) => {
    if (!permissions.canView.includes(r)) return;
    setRoute(r, ctx);
  };

  const render = () => {
    if (!permissions.canView.includes(currentRoute)) {
      return (
        <div className="p-8 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <div className="font-semibold">Access Denied</div>
          <div className="text-sm text-muted-foreground mt-1">
            Your role does not have permission to view this page.
          </div>
        </div>
      );
    }

    switch (currentRoute as RouteKey ) {
      case "dashboard": return <DashboardPage />;
      case "projects": return <ProjectsPage permissions={permissions} />;
      case "layouts": return <LayoutsPage permissions={permissions} />;
      case "interactive-layout":
        return (
          <InteractiveLayoutPage
            key={`${selectedProjectId}-${selectedLayoutId}-${selectedPlotId ?? ""}`}
            selectedProjectId={selectedProjectId}
            selectedLayoutId={selectedLayoutId}
            selectedPlotId={selectedPlotId}
            onNavigate={handleNavigate}
            permissions={permissions}
          />
        );
      case "customers": return <CustomersPage permissions={permissions} />;
      case "bookings": return <BookingsPage permissions={permissions} />;
      case "sales": return <SalesPage permissions={permissions} />;
      case "payments": return <PaymentsPage permissions={permissions} />;
      case "discounts": return <DiscountsPage permissions={permissions} />;
      case "marketing-team": return <MarketingTeamPage permissions={permissions} />;
      case "vacant-plots": return <PlotListPage status="available" permissions={permissions} />;
      case "booked-plots": return <PlotListPage status="booked" permissions={permissions} />;
      case "reserved-plots": return <PlotListPage status="reserved" permissions={permissions} />;
      case "sold-plots": return <PlotListPage status="sold" permissions={permissions} />;
      case "all-plots": return <PlotListPage status="all" permissions={permissions} />;
      case "website-content": return <WebsiteContentPage />;
      case "generate-agreement": return <GenerateAgreementPage />;
      case "reports": return <ReportsPage />;
      case "analytics": return <AnalyticsPage />;
      case "users": return <UsersPage />;
      case "settings": return <SettingsPage />;
      // ---- Attendance module (Supabase 2) ----
      case "att-overview": return <OverviewView />;
      case "att-today": return <TodayView />;
      case "att-employees": return <EmployeesView />;
      case "att-history": return <HistoryView />;
      case "att-reports": return <AttReportsView />;
      case "att-locations": return <LocationsView />;
      case "att-settings": return <AttSettingsView />;
      case "att-audit": return <AuditView />;
      case "att-salary": return <SalaryView />;
      case "att-resources": return <ResourcesView />;
      
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        settings={settings}
        user={appUser}
        onSignOut={signOut}
        permissions={permissions}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          currentRoute={currentRoute}
          data={{ plots, customers, bookings, sales, payments }}
          onNavigate={handleNavigate}
          user={appUser}
          onSignOut={signOut}
        />
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {render()}
        </main>
      </div>
    </div>
  );
}



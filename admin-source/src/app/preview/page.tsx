
"use client";

// ============================================================
// PREVIEW PAGE — bypasses Supabase + auth, injects mock data into the Zustand store.
// Shows the Projects page, Bookings page, and a mock Backup UI so the user can
// verify all fixes without a live Supabase connection.
// ============================================================

import { useEffect, useState } from "react";
import { useCrm } from "@/lib/store";
import { getPermissions } from "@/lib/permissions";
import type { Project, Layout, Plot, Customer } from "@/lib/types";
import ProjectsPage from "@/components/pages/ProjectsPage";
import BookingsPage from "@/components/pages/BookingsPage";
import { Building2, CalendarCheck, FlaskConical, Database, HardDriveDownload, Clock, ShieldCheck, HardDriveUpload, Trash2, Activity } from "lucide-react";
import { formatDate, relativeTime } from "@/lib/format";

// ---- Mock data (matches the structure Supabase would return) ----
const NOW = new Date().toISOString();

const mockProject: Project = {
  id: "preview-p1",
  name: "Preview Sandalwood Farm",
  location: "Anekal, Bengaluru",
  totalArea: "10 Acres",
  numberOfPlots: 18,
  status: "active",
  description: "Mock project for previewing the sqyd pricing + corner config fixes.",
  createdAt: NOW,
  updatedAt: NOW,
};

const mockLayout: Layout = {
  id: "preview-l1",
  projectId: "preview-p1",
  name: "Phase 1",
  description: "2 blocks (A, B) with 9 plots each. Uses sqyd pricing.",
  numberOfPlots: 18,
  createdAt: NOW,
  updatedAt: NOW,
};

// Generate 18 plots: Block A (1-9) + Block B (1-9), using SQYD pricing.
// Base price = 3000 ₹/sqyd, size = 50 sqyd → total = 150,000
// East facing premium = 200, North = 150, corner premium = 250
function makeMockPlots(): Plot[] {
  const plots: Plot[] = [];
  const facings: Plot["facing"][] = ["East", "North", "West", "South", "East", "North", "West", "South", "East"];
  const basePrice = 3000;
  const facingPremium: Record<string, number> = { East: 200, North: 150 };
  const cornerPremium = 250;
  const size = 50;
  const blocks = ["A", "B"];
  blocks.forEach((block) => {
    for (let i = 1; i <= 9; i++) {
      const facing = facings[i - 1];
      const isCorner = i === 1 || i === 9;
      const fp = facingPremium[facing] ?? 0;
      const cp = isCorner ? cornerPremium : 0;
      const effPrice = basePrice + fp + cp;
      // SQYD: total = size × effPrice (NO conversion to cents)
      const total = Math.round(size * effPrice);
      plots.push({
        id: `preview-plot-${block}-${i}`,
        layoutId: "preview-l1",
        projectId: "preview-p1",
        plotNumber: String(i),
        block,
        size,
        sizeUnit: "sqyd",
        facing,
        pricePerCent: effPrice,
        totalPrice: total,
        status: "available",
        cornerPlot: isCorner,
        roadWidth: 30,
        notes: "",
        x: 0, y: 0, width: 0, height: 0, shape: "rect",
        createdAt: NOW,
        updatedAt: NOW,
      });
    }
  });
  return plots;
}

const mockCustomers: Customer[] = [
  {
    id: "preview-c1",
    name: "Ravi Kumar",
    phone: "+91 98765 43210",
    email: "ravi@example.com",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "preview-c2",
    name: "Lakshmi Devi",
    phone: "+91 90000 11111",
    email: "lakshmi@example.com",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "preview-c3",
    name: "Arjun Reddy",
    phone: "+91 88888 22222",
    email: "arjun@example.com",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export default function PreviewPage() {
  const crm = useCrm();
  const [tab, setTab] = useState<"projects" | "bookings" | "backup">("projects");
  const [injected, setInjected] = useState(false);

  // Inject mock data once on mount
  useEffect(() => {
    // Use the store's internal set to inject data directly
    useCrm.setState({
      projects: [mockProject],
      layouts: [mockLayout],
      plots: makeMockPlots(),
      customers: mockCustomers,
      bookings: [],
      sales: [],
      payments: [],
      activityLogs: [],
      isAuthenticated: true,
      currentUserId: "preview-admin",
      currentRoute: "projects",
    });
    setInjected(true);
  }, []);

  // Patch the store's mutation methods so they update local state only (no Supabase calls).
  // We override addProjectWithBlocks / updateProjectWithBlocks with local-only versions
  // so the preview works without a backend.
  useEffect(() => {
    if (!injected) return;
    // The real methods already update local state synchronously before attempting Supabase.
    // Since supabase-client falls back to a no-op client (no env vars), the Supabase calls
    // will resolve harmlessly. So we don't need to override — just let them run.
  }, [injected]);

  const permissions = getPermissions("administrator");

  if (!injected) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="spinner-premium" />
          Loading preview…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Preview banner */}
      <div className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center gap-3 text-sm shadow-md">
        <FlaskConical className="w-4 h-4 shrink-0" />
        <span className="font-semibold">PREVIEW MODE</span>
        <span className="opacity-90 hidden sm:inline">
          · Mock data (no Supabase) · Verify: sqyd pricing, edit-restore, corner config, booking advance total
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setTab("projects")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              tab === "projects" ? "bg-white text-amber-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            <Building2 className="w-3 h-3 inline mr-1" /> Projects
          </button>
          <button
            onClick={() => setTab("bookings")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              tab === "bookings" ? "bg-white text-amber-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            <CalendarCheck className="w-3 h-3 inline mr-1" /> Bookings
          </button>
          <button
            onClick={() => setTab("backup")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              tab === "backup" ? "bg-white text-amber-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            <HardDriveDownload className="w-3 h-3 inline mr-1" /> Backup (Mock)
          </button>
        </div>
      </div>

      {/* Quick stats so the user can verify the mock data */}
      <div className="bg-muted/30 border-b border-border px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          Mock: {crm.projects.length} project · {crm.plots.length} plots · {crm.customers.length} customers
        </span>
        <span>·</span>
        <span>
          Block A Plot 1 (East corner): 50 sqyd × ₹3,450/sqyd = <strong className="text-foreground">₹1,72,500</strong>
        </span>
        <span>·</span>
        <span>
          Block A Plot 2 (East non-corner): 50 sqyd × ₹3,200/sqyd = <strong className="text-foreground">₹1,60,000</strong>
        </span>
        <span>·</span>
        <span>
          Block A Plot 4 (West non-corner): 50 sqyd × ₹3,000/sqyd = <strong className="text-foreground">₹1,50,000</strong>
        </span>
      </div>

      {/* Render the selected page */}
      <div className="p-4 lg:p-6">
        {tab === "projects" ? (
          <ProjectsPage permissions={permissions} />
        ) : tab === "bookings" ? (
          <BookingsPage permissions={permissions} />
        ) : (
          <MockBackupSection />
        )}
      </div>
    </div>
  );
}

// ============================================================
// MOCK BACKUP SECTION — visual preview of the backup UI.
// In production, this data comes from /api/backup/list (real Supabase).
// ============================================================
const mockBackups = [
  { id: "b1", created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), size_bytes: 145200, table_counts: { projects: 1, layouts: 1, plots: 18, customers: 3 }, trigger: "manual", status: "complete", error: null },
  { id: "b2", created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), size_bytes: 142800, table_counts: { projects: 1, layouts: 1, plots: 18, customers: 3 }, trigger: "cron", status: "complete", error: null },
  { id: "b3", created_at: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(), size_bytes: 139400, table_counts: { projects: 1, layouts: 1, plots: 18, customers: 2 }, trigger: "cron", status: "complete", error: null },
];

function MockBackupSection() {
  const [backing, setBacking] = useState(false);
  const [backups, setBackups] = useState(mockBackups);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [retention, setRetention] = useState(30);
  const [restoreConfirm, setRestoreConfirm] = useState<typeof mockBackups[0] | null>(null);

  const lastBackup = backups[0];
  const isStale = lastBackup && (Date.now() - new Date(lastBackup.created_at).getTime()) > 24 * 60 * 60 * 1000;

  const handleBackupNow = () => {
    setBacking(true);
    setTimeout(() => {
      const newBackup = {
        id: `b${Date.now()}`,
        created_at: new Date().toISOString(),
        size_bytes: 145000 + Math.floor(Math.random() * 5000),
        table_counts: { projects: 1, layouts: 1, plots: 18, customers: 3 },
        trigger: "manual" as const,
        status: "complete" as const,
        error: null,
      };
      setBackups([newBackup, ...backups]);
      setBacking(false);
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800">
        <strong>Mock Preview:</strong> This is a visual preview of the Backup &amp; Restore UI.
        In production (with Supabase configured + <code>SUPABASE_SERVICE_ROLE_KEY</code> set),
        these buttons call real API routes that read/write to the <code>backups</code> table.
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <HardDriveDownload className="w-4 h-4 text-primary" />
            <div className="font-semibold text-sm">Backup &amp; Restore</div>
            {lastBackup && !isStale && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-transparent inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Protected
              </span>
            )}
          </div>
          <button
            onClick={handleBackupNow}
            disabled={backing}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {backing ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <HardDriveDownload className="w-3.5 h-3.5" />}
            {backing ? "Backing up…" : "Backup Now"}
          </button>
        </div>

        {/* Status strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last Backup
            </div>
            <div className="text-sm font-semibold mt-1">
              {lastBackup ? relativeTime(lastBackup.created_at) : "Never"}
            </div>
            {lastBackup && <div className="text-[10px] text-muted-foreground">{formatDate(lastBackup.created_at)}</div>}
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <div className="text-[10px] uppercase text-muted-foreground">Status</div>
            <div className="text-sm font-semibold mt-1 text-emerald-600">complete</div>
            <div className="text-[10px] text-muted-foreground">via {lastBackup?.trigger}</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <div className="text-[10px] uppercase text-muted-foreground">Total Backups</div>
            <div className="text-sm font-semibold mt-1">{backups.length}</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <div className="text-[10px] uppercase text-muted-foreground">Auto-Backup</div>
            <div className="text-sm font-semibold mt-1 text-emerald-600">Every 24h</div>
            <div className="text-[10px] text-muted-foreground">Keep last {retention}</div>
          </div>
        </div>

        {/* Config */}
        <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/20 mb-4 flex-wrap">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={(e) => setAutoEnabled(e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="font-medium">Auto-backup every 24 hours</span>
          </label>
          <span className="text-border">|</span>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Retention:</span>
            <input
              type="number"
              min={1}
              max={90}
              value={retention}
              onChange={(e) => setRetention(parseInt(e.target.value) || 30)}
              className="w-16 h-7 px-2 rounded border border-border bg-card text-xs"
            />
            <span className="text-muted-foreground">days</span>
          </label>
          <div className="text-[10px] text-muted-foreground ml-auto">
            Runs via Vercel Cron (daily) or client-side fallback on admin login.
          </div>
        </div>

        {/* Backup history */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {backups.map((b) => {
            const totalRecords = Object.values(b.table_counts).reduce((a, c) => a + c, 0);
            return (
              <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-md border border-border hover:bg-muted/40 text-xs">
                <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0 bg-primary/10 text-primary">
                  {b.trigger === "cron" ? <Clock className="w-4 h-4" /> : b.trigger === "auto" ? <Activity className="w-4 h-4" /> : <HardDriveDownload className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{formatDate(b.created_at)} · {relativeTime(b.created_at)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {totalRecords} records · {(b.size_bytes / 1024).toFixed(1)} KB · via {b.trigger}
                    <span className="ml-1">
                      ({Object.entries(b.table_counts).map(([t, c]) => `${t}:${c}`).join(", ")})
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setRestoreConfirm(b)}
                  className="px-2 h-7 rounded-md border border-border text-xs inline-flex items-center gap-1 hover:bg-muted/50"
                >
                  <HardDriveUpload className="w-3 h-3" />
                  <span className="hidden sm:inline">Restore</span>
                </button>
                <button
                  onClick={() => setBackups(backups.filter((x) => x.id !== b.id))}
                  className="w-7 h-7 rounded-md border border-border text-rose-600 inline-flex items-center justify-center hover:bg-rose-50"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Restore confirmation (mock) */}
      {restoreConfirm && (
        <div className="bg-card border border-amber-400 rounded-lg p-4 space-y-3">
          <div className="font-semibold text-sm flex items-center gap-2">
            <HardDriveUpload className="w-4 h-4 text-amber-600" />
            Restore from backup?
          </div>
          <div className="text-xs text-muted-foreground">
            This will replace ALL current data with the snapshot from{" "}
            <strong>{formatDate(restoreConfirm.created_at)}</strong>. This cannot be undone.
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setRestoreConfirm(null)}
              className="px-3 py-1.5 rounded-md border border-border text-xs"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setRestoreConfirm(null);
                alert("(Mock) In production, this would restore all data from the backup snapshot.");
              }}
              className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs"
            >
              Restore Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



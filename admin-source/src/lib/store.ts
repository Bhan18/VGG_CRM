
// ============================================================
// VGG Infra Developers - Central Zustand Store
// All data persists to localStorage; the data layer is isolated
// so it can be swapped for Firebase / Supabase / Prisma later
// without touching UI components.
// ============================================================
import { create } from "zustand";
import type {
  Project,
  Layout,
  Plot,
  Customer,
  Booking,
  Sale,
  Payment,
  User,
  CompanySettings,
  ActivityLog,
  NotificationItem,
  RouteKey,
  PlotStatus,
  BlockConfig,
  ProjectPricingDefaults,
  UserRole,
  MarketingCadre,
  MarketingAgent,
  MarketingExpense,
  MarketingSale,
  CommissionPayout,
  MarketingPerformanceSettings,
  FrozenPrice,
  FacingDirection,
} from "./types";
import {
  seedSettings,
} from "./seed-data";
import { supabase } from "./supabase-client";
import {
  computePlotStatusFromPayments,
  RESERVE_THRESHOLD,
} from "./format";

interface CrmState {
  // Data collections
  projects: Project[];
  layouts: Layout[];
  plots: Plot[];
  customers: Customer[];
  bookings: Booking[];
  sales: Sale[];
  payments: Payment[];
  users: User[];
  settings: CompanySettings;
  activityLogs: ActivityLog[];
  marketingCadres: MarketingCadre[];
  marketingAgents: MarketingAgent[];
  marketingExpenses: MarketingExpense[];
  marketingSales: MarketingSale[];
  commissionPayouts: CommissionPayout[];
  marketingPerformanceSettings: MarketingPerformanceSettings;

  // UI navigation state
  currentRoute: RouteKey;
  // Context for pages that need params (e.g. selected project/layout for interactive layout)
  selectedProjectId?: string;
  selectedLayoutId?: string;
  selectedPlotId?: string;
  // Role-played as current logged-in user (simulated auth)
  currentUserId: string;
  sidebarCollapsed: boolean;

  // Prefill context for cross-form workflows
  // (e.g. "Add Buyer" on a vacant plot → prefill customer form → prefill booking form)
  prefillCustomer?: { plotId: string; projectId: string; layoutId: string } | null;
  prefillBooking?: { plotId: string; customerId: string; projectId: string; layoutId: string } | null;
  prefillPayment?: { plotId: string; customerId?: string; bookingId?: string } | null;
  clearPrefill: () => void;

  // Auth
  isAuthenticated: boolean;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;

  // Navigation actions
  setRoute: (r: RouteKey, ctx?: Partial<Pick<CrmState, "selectedProjectId" | "selectedLayoutId" | "selectedPlotId">>) => void;
  toggleSidebar: () => void;
  setCurrentUser: (id: string) => void;

  // Project CRUD
  addProject: (p: Omit<Project, "id" | "createdAt" | "updatedAt">) => string;
  // Creates a project + a default "Phase 1" layout + auto-generated plots
  // from the block configuration (plot ranges, facing, corners).
  addProjectWithBlocks: (
    p: Omit<Project, "id" | "createdAt" | "updatedAt">,
    blocks: BlockConfig[],
    layoutName?: string,
    pricingDefaults?: ProjectPricingDefaults,
  ) => Promise<string>;
  // Updates an existing project's block config — PRESERVES existing plot identity
  // (matched by block+plotNumber) so that bookings/sales/payments/status are not lost.
  // All Supabase operations are awaited and any failure throws (caller should surface).
  updateProjectWithBlocks: (
    projectId: string,
    p: Partial<Project>,
    blocks: BlockConfig[],
    layoutName?: string,
    pricingDefaults?: ProjectPricingDefaults,
  ) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;       // soft-delete (move to recycle bin)
  restoreProject: (id: string) => void;      // restore from recycle bin
  permanentlyDeleteProject: (id: string) => void; // hard delete

  // Layout CRUD
  addLayout: (l: Omit<Layout, "id" | "createdAt" | "updatedAt">) => string;
  updateLayout: (id: string, patch: Partial<Layout>) => void;
  deleteLayout: (id: string) => void;

  // Plot CRUD
  addPlot: (p: Omit<Plot, "id" | "createdAt" | "updatedAt">) => string;
  addManyPlots: (plots: Omit<Plot, "id" | "createdAt" | "updatedAt">[]) => void;
  updatePlot: (id: string, patch: Partial<Plot>) => void;
  deletePlot: (id: string) => void;
  setPlotStatus: (id: string, status: PlotStatus, customerId?: string | null, bookingId?: string | null, saleId?: string | null) => void;
  // Recompute a plot's status from accumulated payments (₹50k rule)
  recalcPlotStatus: (plotId: string) => void;

  // Customer CRUD
  addCustomer: (c: Omit<Customer, "id" | "createdAt" | "updatedAt">) => string;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Booking CRUD
  addBooking: (b: Omit<Booking, "id" | "createdAt" | "updatedAt">) => string;
  updateBooking: (id: string, patch: Partial<Booking>) => void;
  deleteBooking: (id: string) => void;

  // Sale CRUD
  addSale: (s: Omit<Sale, "id" | "createdAt" | "updatedAt">) => string;
  updateSale: (id: string, patch: Partial<Sale>) => void;
  deleteSale: (id: string) => void;

  // Marketing team CRUD. Marketing sales are kept in a separate collection
  // (marketing_sales) so marketing and finance remain fully independent.
  addMarketingCadre: (cadre: Omit<MarketingCadre, "id" | "createdAt" | "updatedAt">) => string;
  updateMarketingCadre: (id: string, patch: Partial<MarketingCadre>) => void;
  archiveMarketingCadre: (id: string) => void;
  deleteMarketingCadre: (id: string) => void;
  addMarketingAgent: (agent: Omit<MarketingAgent, "id" | "createdAt" | "updatedAt">) => string;
  updateMarketingAgent: (id: string, patch: Partial<MarketingAgent>) => void;
  archiveMarketingAgent: (id: string) => void;
  deleteMarketingAgent: (id: string) => void;
  addMarketingExpense: (expense: Omit<MarketingExpense, "id" | "createdAt" | "updatedAt">) => string;
  updateMarketingExpense: (id: string, patch: Partial<MarketingExpense>) => void;
  deleteMarketingExpense: (id: string) => void;
  addMarketingSale: (sale: Omit<MarketingSale, "id" | "createdAt" | "updatedAt">) => string;
  updateMarketingSale: (id: string, patch: Partial<MarketingSale>) => void;
  deleteMarketingSale: (id: string) => void;
  addCommissionPayout: (payout: Omit<CommissionPayout, "id" | "createdAt" | "updatedAt">) => string;
  updateCommissionPayout: (id: string, patch: Partial<CommissionPayout>) => void;
  deleteCommissionPayout: (id: string) => void;
  updateMarketingPerformanceSettings: (patch: Partial<MarketingPerformanceSettings>) => void;

  // Payment CRUD
  addPayment: (p: Omit<Payment, "id" | "createdAt">) => string;
  updatePayment: (id: string, patch: Partial<Payment>) => void;
  deletePayment: (id: string) => void;

  // Settings & users
  updateSettings: (patch: Partial<CompanySettings>) => void;
  addUser: (u: Omit<User, "id" | "createdAt">) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // Activity logs
  logActivity: (action: string, entity: string, entityId: string, details?: string) => void;

  // Notifications (derived + stored read-state)
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // Reset (handy during dev / "Restore demo data" in Settings)
  resetToSeed: () => void;

  // Reload users from Supabase
  reloadUsers: () => Promise<void>;

  // Load ALL data from Supabase (called on login)
  loadFromSupabase: () => Promise<void>;
  isSupabaseLoading: boolean;
}

const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const nowISO = () => new Date().toISOString();

// Cache key for persisting block config + pricing per project (so editing restores
// the EXACT values the user entered — no reverse-engineering, no premium double-counting).
export const blockConfigCacheKey = (projectId: string) => `vgg-crm-blockconfig-${projectId}`;

export function saveBlockConfig(projectId: string, blocks: BlockConfig[], pricing: ProjectPricingDefaults) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(blockConfigCacheKey(projectId), JSON.stringify({ blocks, pricing, savedAt: Date.now() }));
  } catch { /* ignore quota errors */ }
}

export function loadBlockConfig(projectId: string): { blocks: BlockConfig[]; pricing: ProjectPricingDefaults } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(blockConfigCacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.blocks || !parsed?.pricing) return null;
    return { blocks: parsed.blocks as BlockConfig[], pricing: parsed.pricing as ProjectPricingDefaults };
  } catch { return null; }
}

// Fallback pricing used when a project is created/updated without explicit pricing defaults.
const defaultPricingDefaults = (): ProjectPricingDefaults => ({
  areaUnit: "cents",
  cornerPremium: 0,
  facingPremiums: {},
});

let realtimeMarketingSubscriptionStarted = false;
let realtimeMarketingReloadTimer: ReturnType<typeof setTimeout> | undefined;

// Parse a plot range string like "1-10, 12, 15" into [1,2,3,...,10,12,15]
export function parsePlotRange(range: string): number[] {
  if (!range) return [];
  const parts = range.split(",").map((s) => s.trim()).filter(Boolean);
  const result: number[] = [];
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          result.push(i);
        }
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) result.push(n);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}

// Convert a size value from any supported unit to cents (Indian land unit).
// 1 cent = 48.4 sq yd
export function toCents(size: number, unit: "cents" | "sqyd"): number {
  if (!size || size <= 0) return 0;
  switch (unit) {
    case "cents": return size;
    case "sqyd": return size / 48.4;
    default: return size;
  }
}

// Calculate total plot price. CRITICAL: do NOT convert sqyd → cents.
// If the project's unit is sqyd, the price entered is ₹/sqyd and the area is in sqyd,
// so total = area_sqyd × price_per_sqyd. Same for cents: total = area_cents × price_per_cent.
// (Previous code converted sqyd to cents first, which silently inflated prices.)
export function calcTotalPrice(size: number, pricePerUnit: number, unit: "cents" | "sqyd"): number {
  if (!size || size <= 0 || !pricePerUnit || pricePerUnit <= 0) return 0;
  // No unit conversion — multiply directly in whatever unit the project uses.
  return Math.round(size * pricePerUnit);
}

// Generate a human-readable reference code for a plot booking/sale.
// Format: ProjectInitials-Block-PlotNo-FacingInitial
// Example: "Vijaya Sandalwood Farm", Block A, Plot 1, South → "VSF-A-1-S"
// Example: "Vijaya Sandalwood Farm", Block B, Plot 12, North-East → "VSF-B-12-NE"
export function generateReferenceCode(
  projectName: string,
  block: string,
  plotNumber: string,
  facing: string,
): string {
  // Take first letter of each word in the project name (skip common suffixes like "Phase")
  const initials = projectName
    .trim()
    .split(/\s+/)
    .filter((w) => !/^(phase|p)$|^\d+$/.test(w.toLowerCase())) // skip "Phase", "P", pure numbers
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  // Facing: first letter of each part (North-East → NE, North → N)
  const facingInitial = facing
    .split("-")
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  return `${initials}-${block}-${plotNumber}-${facingInitial}`;
}

/**
 * Build a FrozenPrice snapshot for a plot by reverse-engineering base /
 * facing / corner premiums from sibling plots in the same project. Works on
 * any browser (no localStorage cache dependency) and matches the algorithm
 * ProjectsPage uses when reconstructing block configs from existing plots.
 *
 * Algorithm:
 *   - Group non-corner plots by facing → min(pricePerCent) per facing = base + facingPremium
 *   - Global min across all facings = pure base (the facing with no premium, or lowest premium)
 *   - facingPremium[facing] = min(facing) − globalBase
 *   - cornerPremium = min(corner plots for a facing) − min(non-corner for same facing)
 *   - For this plot: base = pricePerCent − facingPremium[plot.facing] − (cornerPlot ? cornerPremium : 0)
 *
 * Falls back gracefully if there isn't enough data (e.g., single-plot project):
 *   - base = pricePerCent, facingPremium = 0, cornerPremium = 0
 */
export function buildFrozenPrice(plot: Plot, allPlotsInProject: Plot[]): FrozenPrice {
  const facingPremiums: Partial<Record<FacingDirection, number>> = {};
  let detectedCornerPremium = 0;
  let detectedBase = plot.pricePerCent;

  if (allPlotsInProject.length > 0) {
    const nonCornerByFacing: Record<string, number[]> = {};
    const cornerByFacing: Record<string, number[]> = {};
    allPlotsInProject.forEach((p) => {
      const key = p.facing;
      if (p.cornerPlot) {
        (cornerByFacing[key] ||= []).push(p.pricePerCent);
      } else {
        (nonCornerByFacing[key] ||= []).push(p.pricePerCent);
      }
    });
    const nonCornerMins: Record<string, number> = {};
    Object.entries(nonCornerByFacing).forEach(([f, arr]) => {
      nonCornerMins[f] = Math.min(...arr);
    });
    const baseCandidates = Object.values(nonCornerMins);
    if (baseCandidates.length > 0) {
      detectedBase = Math.min(...baseCandidates);
      Object.entries(nonCornerMins).forEach(([f, min]) => {
        const premium = min - detectedBase;
        if (premium > 0) facingPremiums[f as FacingDirection] = premium;
      });
      // Corner premium: compare corner vs non-corner for same facing
      for (const [f, cornerArr] of Object.entries(cornerByFacing)) {
        if (nonCornerMins[f] !== undefined && cornerArr.length > 0) {
          const cornerMin = Math.min(...cornerArr);
          const diff = cornerMin - nonCornerMins[f];
          if (diff > 0) detectedCornerPremium = diff;
        }
      }
    }
  }

  const facingPrem = facingPremiums[plot.facing] ?? 0;
  const cornerPrem = plot.cornerPlot ? detectedCornerPremium : 0;
  const basePerUnit = Math.max(0, plot.pricePerCent - facingPrem - cornerPrem);
  const effectivePerUnit = plot.pricePerCent;
  return {
    basePricePerUnit: Math.round(basePerUnit * 100) / 100,
    facingPremiumPerUnit: Math.round(facingPrem * 100) / 100,
    cornerPremiumPerUnit: Math.round(cornerPrem * 100) / 100,
    effectivePricePerUnit: Math.round(effectivePerUnit * 100) / 100,
    size: plot.size,
    sizeUnit: plot.sizeUnit,
    totalPrice: Math.round(plot.totalPrice * 100) / 100,
    frozenAt: nowISO(),
  };
}

export const useCrm = create<CrmState>()(
    (set, get) => ({
      projects: [],
      layouts: [],
      plots: [],
      customers: [],
      bookings: [],
      sales: [],
      payments: [],
      users: [],
      settings: seedSettings,
      activityLogs: [],
      marketingCadres: [],
      marketingAgents: [],
      marketingExpenses: [],
      marketingSales: [],
      commissionPayouts: [],
      marketingPerformanceSettings: { salesVolumeWeight: 40, revenueWeight: 30, plotsSoldWeight: 20, conversionRateWeight: 10 },
      notifications: [],
      currentRoute: "dashboard",
      selectedProjectId: undefined,
      selectedLayoutId: undefined,
      currentUserId: "",
      sidebarCollapsed: false,
      isAuthenticated: false,

      login: (email, password) => {
        // Auth handled by Supabase Auth (auth-provider.tsx)
        // This is kept for backward compat but should not be called directly
        return { ok: false, error: "Use Supabase Auth" };
      },
      logout: () => set({ isAuthenticated: false, currentRoute: "dashboard", projects: [], layouts: [], plots: [], customers: [], bookings: [], sales: [], payments: [], users: [], activityLogs: [], marketingCadres: [], marketingAgents: [], marketingExpenses: [], marketingSales: [], commissionPayouts: [], settings: seedSettings }),

      setRoute: (r, ctx) =>
        set((s) => ({
          currentRoute: r,
          selectedProjectId: ctx?.selectedProjectId ?? s.selectedProjectId,
          selectedLayoutId: ctx?.selectedLayoutId ?? s.selectedLayoutId,
          selectedPlotId: ctx?.selectedPlotId ?? s.selectedPlotId,
        })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCurrentUser: (id) => set({ currentUserId: id }),
      clearPrefill: () =>
        set({
          prefillCustomer: null,
          prefillBooking: null,
          prefillPayment: null,
        }),

      addProject: (p) => {
        const id = uid("p");
        const project: Project = { ...p, id, createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ projects: [project, ...s.projects] }));
        supabase.from("projects").insert({
          id, name: p.name, location: p.location, total_area: p.totalArea,
          number_of_plots: p.numberOfPlots, layout_image: p.layoutImage, status: p.status,
          description: p.description,
        }).then(({ error }) => { if (error) console.error("Supabase insert project:", error); });
        get().logActivity("CREATE_PROJECT", "project", id, `Created project ${p.name}`);
        return id;
      },
      addProjectWithBlocks: async (p, blocks, layoutName = "Phase 1", pricingDefaults) => {
        const projectId = uid("p");
        const layoutId = uid("l");
        const project: Project = { ...p, id: projectId, createdAt: nowISO(), updatedAt: nowISO() };
        const layout: Layout = {
          id: layoutId,
          projectId,
          name: layoutName,
          description: `Auto-generated layout for ${p.name}. Contains ${blocks.length} block(s).`,
          numberOfPlots: 0,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };

        // Generate plots from block configs with proper canvas positioning
        const newPlots: Plot[] = [];
        const blockCount = blocks.length;
        const cols = blockCount <= 1 ? 1 : blockCount <= 4 ? 2 : 3;
        const rows = Math.ceil(blockCount / cols);
        const margin = 3;
        const gap = 3;
        const blockW = (100 - margin * 2 - (cols - 1) * gap) / cols;
        const blockH = (100 - margin * 2 - (rows - 1) * gap) / rows;
        const titleAreaH = 4;

        blocks.forEach((block, blockIdx) => {
          const col = blockIdx % cols;
          const row = Math.floor(blockIdx / cols);
          const blockX = margin + col * (blockW + gap);
          const blockY = margin + row * (blockH + gap);

          const plotNums = parsePlotRange(block.plotRange);
          const cornerNums = parsePlotRange(block.cornerPlots);
          const plotCols = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(plotNums.length * 1.4))));
          const plotRows = Math.ceil(plotNums.length / plotCols);
          const innerW = blockW - 2;
          const innerH = blockH - titleAreaH - 2;
          const plotW = (innerW - (plotCols - 1) * 0.4) / plotCols;
          const plotH = (innerH - (plotRows - 1) * 0.4) / plotRows;

          plotNums.forEach((num, i) => {
            const pCol = i % plotCols;
            const pRow = Math.floor(i / plotCols);
            // Apply per-plot assignments/overrides if present
            const plotFacing = block.facingAssignments?.[num] ?? block.defaultFacing;
            const plotSize = block.sizeOverrides?.[num] ?? block.defaultSize;
            const basePricePerUnit = block.priceOverrides?.[num] ?? block.defaultPricePerUnit;
            const isCorner = cornerNums.includes(num);
            // Use project-level pricing defaults for premiums
            const areaUnit = pricingDefaults?.areaUnit ?? "cents";
            const facingPremium = pricingDefaults?.facingPremiums?.[plotFacing] ?? 0;
            const cornerPremium = isCorner ? (pricingDefaults?.cornerPremium ?? 0) : 0;
            const effectivePricePerUnit = basePricePerUnit + facingPremium + cornerPremium;
            // CRITICAL: do NOT convert sqyd → cents. Total = size × effectivePricePerUnit
            // in whatever unit the project uses (sqyd×₹/sqyd or cents×₹/cent).
            const totalPrice = calcTotalPrice(plotSize, effectivePricePerUnit, areaUnit);

            newPlots.push({
              id: uid("plot"),
              layoutId,
              projectId,
              plotNumber: String(num),
              block: block.name,
              size: plotSize,
              sizeUnit: areaUnit,
              facing: plotFacing,
              pricePerCent: effectivePricePerUnit,
              totalPrice,
              basePricePerUnit,
              status: "available",
              cornerPlot: isCorner,
              roadWidth: block.roadWidth,
              notes: "",
              x: blockX + 1 + pCol * (plotW + 0.4),
              y: blockY + titleAreaH + pRow * (plotH + 0.4),
              width: plotW,
              height: plotH,
              shape: "rect",
              createdAt: nowISO(),
              updatedAt: nowISO(),
            });
          });
        });

        // Update layout plot count
        layout.numberOfPlots = newPlots.length;
        project.numberOfPlots = newPlots.length;

        set((s) => ({
          projects: [project, ...s.projects],
          layouts: [layout, ...s.layouts],
          plots: [...s.plots, ...newPlots],
        }));

        // Persist block config + pricing locally so editing later restores EXACT values
        // (prevents the premium double-counting bug on re-edit).
        saveBlockConfig(projectId, blocks, pricingDefaults ?? defaultPricingDefaults());

        // ----- AWAITED Supabase writes (previously fire-and-forget = silent data loss) -----
        // Order matters: project + layout → plots (FK constraints). The project and layout
        // inserts are independent of each other so they run in parallel; plots follow after
        // both exist. If any step fails we throw so the caller can surface an error toast.
        const [pe, le] = await Promise.all([
          supabase.from("projects").insert({
            id: projectId, name: p.name, location: p.location, total_area: p.totalArea,
            number_of_plots: newPlots.length, layout_image: p.layoutImage, status: p.status,
            description: p.description,
          }),
          supabase.from("layouts").insert({
            id: layoutId, project_id: projectId, name: layoutName,
            description: layout.description, number_of_plots: newPlots.length,
          }),
        ]);
        if (pe.error) throw new Error(`Failed to create project: ${pe.error.message}`);
        if (le.error) throw new Error(`Failed to create layout: ${le.error.message}`);

        const plotRows = newPlots.map((plot) => ({
          id: plot.id, layout_id: layoutId, project_id: projectId,
          plot_number: plot.plotNumber, block: plot.block, size: plot.size,
          size_unit: plot.sizeUnit, facing: plot.facing, price_per_cent: plot.pricePerCent,
          total_price: plot.totalPrice,
          base_price_per_unit: plot.basePricePerUnit ?? null,
          status: plot.status, corner_plot: plot.cornerPlot,
          road_width: plot.roadWidth, notes: plot.notes, x: plot.x, y: plot.y,
          width: plot.width, height: plot.height, created_at: plot.createdAt, updated_at: plot.updatedAt,
        }));
        const plotBatches: typeof plotRows[] = [];
        for (let i = 0; i < plotRows.length; i += 100) {
          plotBatches.push(plotRows.slice(i, i + 100));
        }
        const plotResults = await Promise.all(
          plotBatches.map((batch) => supabase.from("plots").insert(batch)),
        );
        for (const { error } of plotResults) {
          if (error) throw new Error(`Failed to create plots: ${error.message}`);
        }

        get().logActivity(
          "CREATE_PROJECT",
          "project",
          projectId,
          `Created project ${p.name} with ${blocks.length} block(s) and ${newPlots.length} plots`,
        );
        return projectId;
      },
      updateProjectWithBlocks: async (projectId, p, blocks, layoutName = "Phase 1", pricingDefaults) => {
        // 1. Find existing plots & layout for this project (do NOT delete blindly)
        const existingPlots = get().plots.filter((plot) => plot.projectId === projectId);
        const existingLayouts = get().layouts.filter((l) => l.projectId === projectId);
        const existingLayout = existingLayouts[0];

        // 2. Reuse the existing layout ID (UPDATE in place — fixes the PK-conflict race
        //    that happened when the old code did delete().eq("id", l.id) then insert()
        //    with the same id, both fire-and-forget.)
        const layoutId = existingLayout?.id ?? uid("l");
        const layout: Layout = {
          id: layoutId,
          projectId,
          name: layoutName,
          description: `Auto-generated layout for ${p?.name ?? "project"}. Contains ${blocks.length} block(s).`,
          numberOfPlots: 0,
          createdAt: existingLayout?.createdAt ?? nowISO(),
          updatedAt: nowISO(),
        };

        // 3. Build a map of existing plots keyed by (block|plotNumber) so we can preserve
        //    their id + status + customer/booking/sale links + notes when regenerating.
        //    Without this, every save would orphan every booking/sale/payment.
        const existingPlotMap = new Map<string, Plot>();
        existingPlots.forEach((plot) => {
          existingPlotMap.set(`${plot.block}|${plot.plotNumber}`, plot);
        });

        // 4. Generate new plots from block configs.
        //    For each generated plot, if a matching existing plot is found (same block +
        //    plot number), reuse its id and preserve status/customer/booking/sale/notes.
        const newPlots: Plot[] = [];
        const reusedIds = new Set<string>();
        const blockCount = blocks.length;
        const cols = blockCount <= 1 ? 1 : blockCount <= 4 ? 2 : 3;
        const rows = Math.ceil(blockCount / cols);
        const margin = 3, gap = 3;
        const blockW = (100 - margin * 2 - (cols - 1) * gap) / cols;
        const blockH = (100 - margin * 2 - (rows - 1) * gap) / rows;
        const titleAreaH = 4;

        blocks.forEach((block, blockIdx) => {
          const col = blockIdx % cols;
          const row = Math.floor(blockIdx / cols);
          const blockX = margin + col * (blockW + gap);
          const blockY = margin + row * (blockH + gap);
          const plotNums = parsePlotRange(block.plotRange);
          const cornerNums = parsePlotRange(block.cornerPlots);
          const plotCols = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(plotNums.length * 1.4))));
          const pRows = Math.ceil(plotNums.length / plotCols);
          const innerW = blockW - 2;
          const innerH = blockH - titleAreaH - 2;
          const plotW = (innerW - (plotCols - 1) * 0.4) / plotCols;
          const plotH = (innerH - (pRows - 1) * 0.4) / pRows;

          plotNums.forEach((num, i) => {
            const pCol = i % plotCols;
            const pRow = Math.floor(i / plotCols);
            const plotFacing = block.facingAssignments?.[num] ?? block.defaultFacing;
            const plotSize = block.sizeOverrides?.[num] ?? block.defaultSize;
            const basePricePerUnit = block.priceOverrides?.[num] ?? block.defaultPricePerUnit;
            const isCorner = cornerNums.includes(num);
            const areaUnit = pricingDefaults?.areaUnit ?? "cents";
            const facingPremium = pricingDefaults?.facingPremiums?.[plotFacing] ?? 0;
            const cornerPremium = isCorner ? (pricingDefaults?.cornerPremium ?? 0) : 0;
            const effectivePricePerUnit = basePricePerUnit + facingPremium + cornerPremium;
            // CRITICAL: do NOT convert sqyd → cents. Total = size × effectivePricePerUnit
            // in whatever unit the project uses (sqyd×₹/sqyd or cents×₹/cent).
            const totalPrice = calcTotalPrice(plotSize, effectivePricePerUnit, areaUnit);

            // ---- preserve existing plot identity ----
            const matchKey = `${block.name}|${String(num)}`;
            const existing = existingPlotMap.get(matchKey);
            const plotId = existing?.id ?? uid("plot");
            if (existing) reusedIds.add(existing.id);

            // BUSINESS RULE: editing the layout price must NOT affect plots that
            // have already been booked / reserved / sold. Their pricePerCent,
            // totalPrice, and basePricePerUnit are FROZEN at the value they had
            // when the booking/sale was created. Only available plots get the
            // freshly-computed price from the edited block config.
            const isFrozen = existing
              && (existing.status === "booked"
                || existing.status === "reserved"
                || existing.status === "sold");

            newPlots.push({
              id: plotId, layoutId, projectId, plotNumber: String(num), block: block.name,
              size: plotSize, sizeUnit: areaUnit, facing: plotFacing,
              pricePerCent: isFrozen ? existing!.pricePerCent : effectivePricePerUnit,
              totalPrice: isFrozen ? existing!.totalPrice : totalPrice,
              basePricePerUnit: isFrozen
                ? (existing!.basePricePerUnit ?? existing!.pricePerCent)
                : basePricePerUnit,
              // Preserve frozenPrice for booked/reserved/sold plots (snapshot
              // captured at original booking time — must NOT be touched when
              // the layout is edited). Available plots have no frozenPrice.
              frozenPrice: isFrozen ? existing!.frozenPrice : undefined,
              // Preserve status + relationships — these MUST NOT be reset on save.
              status: existing?.status ?? "available",
              customerId: existing?.customerId,
              bookingId: existing?.bookingId,
              saleId: existing?.saleId,
              notes: existing?.notes ?? "",
              cornerPlot: isCorner, roadWidth: block.roadWidth,
              x: blockX + 1 + pCol * (plotW + 0.4), y: blockY + titleAreaH + pRow * (plotH + 0.4),
              width: plotW, height: plotH, shape: "rect",
              createdAt: existing?.createdAt ?? nowISO(), updatedAt: nowISO(),
            });
          });
        });

        // 5. Determine which existing plots need to be deleted (no longer in the new set).
        const plotsToDelete = existingPlots.filter((plot) => !reusedIds.has(plot.id));

        // 6. Update local state synchronously (UI feels instant)
        set((s) => ({
          plots: [...s.plots.filter((plot) => plot.projectId !== projectId), ...newPlots],
          layouts: [layout, ...s.layouts.filter((l) => l.id !== layoutId)],
          projects: s.projects.map((pr) => pr.id === projectId
            ? { ...pr, ...p, numberOfPlots: newPlots.length, updatedAt: nowISO() }
            : pr),
        }));

        // Persist block config + pricing locally so the next edit restores EXACT values
        // (prevents the premium double-counting bug on re-edit).
        saveBlockConfig(projectId, blocks, pricingDefaults ?? defaultPricingDefaults());

        // 7. ----- AWAITED Supabase operations (previously fire-and-forget = silent data loss) -----
        //    a. UPSERT the layout (insert if new, update if exists) — fixes the PK-conflict race
        //    b. UPDATE the project fields
        //    c. DELETE plots that are no longer in the new set (batched, in parallel)
        //    d. UPSERT the new plots (insert if new, update if reused id) — fixes FK violations
        //    e. UPDATE layout & project plot counts
        //    All of these are independent when the layout already exists, so they run in
        //    parallel (several round-trips collapse into one) — this is what makes save
        //    feel fast. If the layout is brand new it must be inserted first (FK), then
        //    the rest run in parallel. If any step fails, throw — caller surfaces a toast.

        // 7a. Layout upsert (single RPC-like flow: try insert, fall back to update)
        const layoutWrite = existingLayout
          ? supabase.from("layouts").update({
              name: layoutName,
              description: layout.description,
              number_of_plots: newPlots.length,
              updated_at: nowISO(),
            }).eq("id", layoutId)
          : supabase.from("layouts").insert({
              id: layoutId, project_id: projectId, name: layoutName,
              description: layout.description, number_of_plots: newPlots.length,
              created_at: layout.createdAt, updated_at: nowISO(),
            });
        if (!existingLayout) {
          // Plots reference layout_id — the layout row must exist before the plot upsert.
          const { error: lie } = await layoutWrite;
          if (lie) throw new Error(`Failed to create layout: ${lie.message}`);
        }

        // 7b. Project update (only when fields actually changed)
        const projectWrite = (async () => {
          if (p && Object.keys(p).length > 0) {
            const projUpdate: Record<string, unknown> = {};
            if (p.name !== undefined) projUpdate.name = p.name;
            if (p.location !== undefined) projUpdate.location = p.location;
            if (p.totalArea !== undefined) projUpdate.total_area = p.totalArea;
            if (p.numberOfPlots !== undefined) projUpdate.number_of_plots = p.numberOfPlots;
            if (p.layoutImage !== undefined) projUpdate.layout_image = p.layoutImage;
            if (p.status !== undefined) projUpdate.status = p.status;
            if (p.description !== undefined) projUpdate.description = p.description;
            projUpdate.number_of_plots = newPlots.length; // always sync
            projUpdate.updated_at = nowISO();
            const { error: pue } = await supabase.from("projects").update(projUpdate).eq("id", projectId);
            if (pue) throw new Error(`Failed to update project: ${pue.message}`);
          }
        })();

        // 7c. Delete plots that are no longer in the new set (batched, in parallel)
        const deleteWrite = (async () => {
          const batches: string[][] = [];
          for (let i = 0; i < plotsToDelete.length; i += 100) {
            batches.push(plotsToDelete.slice(i, i + 100).map((pl) => pl.id));
          }
          const results = await Promise.all(
            batches.map((ids) => supabase.from("plots").delete().in("id", ids)),
          );
          for (const { error } of results) {
            if (error) throw new Error(`Failed to delete removed plots: ${error.message}`);
          }
        })();

        // 7d. UPSERT the new plots.
        //     Supabase's .upsert() with defaultPreferences will INSERT new rows and UPDATE
        //     existing rows (matched on PK = id). onConflict: "id" makes this explicit.
        const plotRows = newPlots.map((plot) => ({
          id: plot.id, layout_id: layoutId, project_id: projectId,
          plot_number: plot.plotNumber, block: plot.block, size: plot.size,
          size_unit: plot.sizeUnit, facing: plot.facing, price_per_cent: plot.pricePerCent,
          total_price: plot.totalPrice,
          base_price_per_unit: plot.basePricePerUnit ?? null,
          frozen_price: plot.frozenPrice ?? null,
          status: plot.status, corner_plot: plot.cornerPlot,
          road_width: plot.roadWidth, notes: plot.notes, x: plot.x, y: plot.y,
          width: plot.width, height: plot.height,
          customer_id: plot.customerId ?? null,
          booking_id: plot.bookingId ?? null,
          sale_id: plot.saleId ?? null,
          created_at: plot.createdAt, updated_at: plot.updatedAt,
        }));
        const plotBatches: typeof plotRows[] = [];
        for (let i = 0; i < plotRows.length; i += 100) {
          plotBatches.push(plotRows.slice(i, i + 100));
        }
        const plotWrite = (async () => {
          const results = await Promise.all(
            plotBatches.map((batch) => supabase.from("plots").upsert(batch, { onConflict: "id" })),
          );
          for (const { error } of results) {
            if (error) throw new Error(`Failed to save plots: ${error.message}`);
          }
        })();

        // Run the remaining writes in parallel — the layout already exists now.
        await Promise.all([layoutWrite, projectWrite, deleteWrite, plotWrite]);

        get().logActivity("UPDATE_PROJECT", "project", projectId,
          `Updated project with ${blocks.length} block(s) and ${newPlots.length} plots (${plotsToDelete.length} removed, ${reusedIds.size} preserved)`);
      },
      updateProject: (id, patch) => {
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowISO() } : p)),
        }));
        const update: Record<string, unknown> = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.location !== undefined) update.location = patch.location;
        if (patch.totalArea !== undefined) update.total_area = patch.totalArea;
        if (patch.numberOfPlots !== undefined) update.number_of_plots = patch.numberOfPlots;
        if (patch.layoutImage !== undefined) update.layout_image = patch.layoutImage;
        if (patch.status !== undefined) update.status = patch.status;
        if (patch.description !== undefined) update.description = patch.description;
        if (Object.keys(update).length > 0) {
          supabase.from("projects").update(update).eq("id", id)
            .then(({ error }) => { if (error) console.error("Supabase update project:", error); });
        }
        get().logActivity("UPDATE_PROJECT", "project", id, `Updated project ${id}`);
      },
      deleteProject: (id) => {
        // Soft-delete: mark as deleted, hide from active list, preserve all related data.
        const deletedBy = get().users.find((u) => u.id === get().currentUserId)?.name;
        const now = nowISO();
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, isDeleted: true, deletedAt: now, deletedBy, updatedAt: now }
              : p,
          ),
        }));
        supabase.from("projects").update({ is_deleted: true, deleted_at: now, deleted_by: deletedBy, updated_at: now }).eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase soft-delete project:", error); });
        get().logActivity("DELETE_PROJECT", "project", id, `Project moved to Recycle Bin`);
      },
      restoreProject: (id) => {
        const now = nowISO();
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, isDeleted: false, deletedAt: undefined, deletedBy: undefined, updatedAt: now }
              : p,
          ),
        }));
        supabase.from("projects").update({ is_deleted: false, deleted_at: null, deleted_by: null, updated_at: now }).eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase restore project:", error); });
        get().logActivity("RESTORE_PROJECT", "project", id, `Project restored from Recycle Bin`);
      },
      permanentlyDeleteProject: (id) => {
        // Hard delete — removes project + its layouts + plots only.
        // Customers, bookings, payments are NOT deleted (they belong to the customer).
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          layouts: s.layouts.filter((l) => l.projectId !== id),
          plots: s.plots.filter((p) => p.projectId !== id),
        }));
        supabase.from("projects").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase permanent delete project:", error); });
        get().logActivity("PERMANENT_DELETE_PROJECT", "project", id, `Project permanently deleted`);
      },

      addLayout: (l) => {
        const id = uid("l");
        const layout: Layout = { ...l, id, createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ layouts: [layout, ...s.layouts] }));
        supabase.from("layouts").insert({ id, project_id: l.projectId, name: l.name, image: l.image, description: l.description, number_of_plots: l.numberOfPlots, created_at: nowISO(), updated_at: nowISO() }).then(({ error }) => { if (error) console.error("Supabase layout insert:", error); });
        get().logActivity("CREATE_LAYOUT", "layout", id, `Created layout ${l.name}`);
        return id;
      },
      updateLayout: (id, patch) => {
        set((s) => ({
          layouts: s.layouts.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: nowISO() } : l)),
        }));
        const update: Record<string, unknown> = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.image !== undefined) update.image = patch.image;
        if (patch.description !== undefined) update.description = patch.description;
        if (patch.numberOfPlots !== undefined) update.number_of_plots = patch.numberOfPlots;
        if (Object.keys(update).length > 0) {
          supabase.from("layouts").update(update).eq("id", id)
            .then(({ error }) => { if (error) console.error("Supabase update layout:", error); });
        }
        get().logActivity("UPDATE_LAYOUT", "layout", id, `Updated layout ${id}`);
      },
      deleteLayout: (id) => {
        set((s) => ({
          layouts: s.layouts.filter((l) => l.id !== id),
          plots: s.plots.filter((p) => p.layoutId !== id),
        }));
        supabase.from("layouts").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete layout:", error); });
        get().logActivity("DELETE_LAYOUT", "layout", id, `Deleted layout ${id}`);
      },

      addPlot: (p) => {
        const id = uid("plot");
        const plot: Plot = { ...p, id, createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ plots: [...s.plots, plot] }));
        supabase.from("plots").insert({ id, layout_id: p.layoutId, project_id: p.projectId, plot_number: p.plotNumber, block: p.block, size: p.size, size_unit: p.sizeUnit, facing: p.facing, price_per_cent: p.pricePerCent, total_price: p.totalPrice, base_price_per_unit: p.basePricePerUnit ?? null, frozen_price: p.frozenPrice ?? null, status: p.status, corner_plot: p.cornerPlot, road_width: p.roadWidth, notes: p.notes, x: p.x, y: p.y, width: p.width, height: p.height, created_at: nowISO(), updated_at: nowISO() }).then(({ error }) => { if (error) console.error("Supabase plot insert:", error); });
        get().logActivity("CREATE_PLOT", "plot", id, `Created plot ${p.plotNumber}`);
        return id;
      },
      addManyPlots: (plots) => {
        const newPlots: Plot[] = plots.map((p) => ({
          ...p,
          id: uid("plot"),
          createdAt: nowISO(),
          updatedAt: nowISO(),
        }));
        set((s) => ({ plots: [...s.plots, ...newPlots] }));
      },
      updatePlot: (id, patch) => {
        set((s) => ({
          plots: s.plots.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowISO() } : p)),
        }));
        const update: Record<string, unknown> = {};
        if (patch.plotNumber !== undefined) update.plot_number = patch.plotNumber;
        if (patch.block !== undefined) update.block = patch.block;
        if (patch.size !== undefined) update.size = patch.size;
        if (patch.sizeUnit !== undefined) update.size_unit = patch.sizeUnit;
        if (patch.facing !== undefined) update.facing = patch.facing;
        if (patch.pricePerCent !== undefined) update.price_per_cent = patch.pricePerCent;
        if (patch.totalPrice !== undefined) update.total_price = patch.totalPrice;
        if (patch.basePricePerUnit !== undefined) update.base_price_per_unit = patch.basePricePerUnit;
        // frozenPrice can be set (captured) or cleared (undefined → null in DB).
        if (patch.frozenPrice !== undefined) {
          update.frozen_price = patch.frozenPrice ?? null;
        }
        if (patch.status !== undefined) update.status = patch.status;
        if (patch.cornerPlot !== undefined) update.corner_plot = patch.cornerPlot;
        if (patch.roadWidth !== undefined) update.road_width = patch.roadWidth;
        if (patch.notes !== undefined) update.notes = patch.notes;
        if (Object.keys(update).length > 0) {
          supabase.from("plots").update(update).eq("id", id)
            .then(({ error }) => { if (error) console.error("Supabase plot update:", error); });
        }
        get().logActivity("UPDATE_PLOT", "plot", id, `Updated plot ${id}`);
      },
      deletePlot: (id) => {
        set((s) => ({ plots: s.plots.filter((p) => p.id !== id) }));
        supabase.from("plots").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete plot:", error); });
        get().logActivity("DELETE_PLOT", "plot", id, `Deleted plot ${id}`);
      },
      setPlotStatus: (id, status, customerId, bookingId, saleId) => {
        // FROZEN PRICE LOGIC — central hook for capturing/clearing the snapshot.
        //   - Transitioning to booked/reserved/sold → CAPTURE frozenPrice from
        //     current plot price + sibling plots in the same project.
        //   - Transitioning to available (booking cancelled/sale reversed) →
        //     CLEAR frozenPrice so the plot reverts to the live layout price.
        //   - Other transitions (e.g. booked → sold, or reserved → booked on
        //     payment recompute) → PRESERVE existing frozenPrice (already
        //     captured at original booking time).
        const currentPlot = get().plots.find((p) => p.id === id);
        let frozenPricePatch: Partial<Plot> = {};
        if (currentPlot) {
          const enteringActive = (status === "booked" || status === "reserved" || status === "sold");
          const wasActive = (currentPlot.status === "booked" || currentPlot.status === "reserved" || currentPlot.status === "sold");
          if (enteringActive && !currentPlot.frozenPrice) {
            // Capture snapshot from sibling plots in the same project.
            const siblings = get().plots.filter((p) => p.projectId === currentPlot.projectId);
            frozenPricePatch.frozenPrice = buildFrozenPrice(currentPlot, siblings);
          } else if (status === "available" && wasActive) {
            // Cancellation / reversal — clear the snapshot.
            frozenPricePatch.frozenPrice = undefined;
          }
        }
        set((s) => ({
          plots: s.plots.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...frozenPricePatch,
                  status,
                  customerId: customerId === null ? undefined : customerId === undefined ? p.customerId : customerId,
                  bookingId: bookingId === null ? undefined : bookingId === undefined ? p.bookingId : bookingId,
                  saleId: saleId === null ? undefined : saleId === undefined ? p.saleId : saleId,
                  updatedAt: nowISO(),
                }
              : p,
          ),
        }));
        const update: Record<string, unknown> = { status };
        if (customerId !== undefined) update.customer_id = customerId === null ? null : customerId;
        if (bookingId !== undefined) update.booking_id = bookingId === null ? null : bookingId;
        if (saleId !== undefined) update.sale_id = saleId === null ? null : saleId;
        // Persist frozenPrice patch to Supabase (JSONB column).
        if (frozenPricePatch.frozenPrice !== undefined) {
          update.frozen_price = frozenPricePatch.frozenPrice;
        } else if (frozenPricePatch.frozenPrice === undefined && currentPlot && (status === "available") && (currentPlot.status === "booked" || currentPlot.status === "reserved" || currentPlot.status === "sold")) {
          update.frozen_price = null;
        }
        supabase.from("plots").update(update).eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase setPlotStatus:", error); });
      },
      // Recompute plot status from accumulated payments (₹50k rule).
      // Called automatically after every payment create/update/delete.
      recalcPlotStatus: (plotId) => {
        const plot = get().plots.find((p) => p.id === plotId);
        if (!plot) return;
        const payments = get().payments;
        const newStatus = computePlotStatusFromPayments(plot, payments);
        if (newStatus !== plot.status) {
          get().setPlotStatus(plotId, newStatus);
        }
      },

      addCustomer: (c) => {
        const id = uid("c");
        const customer: Customer = { ...c, id, createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ customers: [customer, ...s.customers] }));
        supabase.from("customers").insert({
          id, name: c.name, father_name: c.fatherName, mother_name: c.motherName,
          phone: c.phone, alternate_phone: c.alternatePhone, email: c.email,
          address: c.address, city: c.city, state: c.state, pin_code: c.pinCode,
          occupation: c.occupation, pan: c.pan, aadhaar: c.aadhaar, photo: c.photo, remarks: c.remarks,
        }).then(({ error }) => { if (error) console.error("Supabase customer:", error); });
        get().logActivity("CREATE_CUSTOMER", "customer", id, `Added customer ${c.name}`);
        return id;
      },
      updateCustomer: (id, patch) => {
        set((s) => ({
          customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: nowISO() } : c)),
        }));
        const update: Record<string, unknown> = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.fatherName !== undefined) update.father_name = patch.fatherName;
        if (patch.motherName !== undefined) update.mother_name = patch.motherName;
        if (patch.phone !== undefined) update.phone = patch.phone;
        if (patch.alternatePhone !== undefined) update.alternate_phone = patch.alternatePhone;
        if (patch.email !== undefined) update.email = patch.email;
        if (patch.address !== undefined) update.address = patch.address;
        if (patch.city !== undefined) update.city = patch.city;
        if (patch.state !== undefined) update.state = patch.state;
        if (patch.pinCode !== undefined) update.pin_code = patch.pinCode;
        if (patch.occupation !== undefined) update.occupation = patch.occupation;
        if (patch.pan !== undefined) update.pan = patch.pan;
        if (patch.aadhaar !== undefined) update.aadhaar = patch.aadhaar;
        if (patch.photo !== undefined) update.photo = patch.photo;
        if (patch.remarks !== undefined) update.remarks = patch.remarks;
        if (patch.referenceCode !== undefined) update.reference_code = patch.referenceCode;
        if (patch.hasBooking !== undefined) update.has_booking = patch.hasBooking;
        if (Object.keys(update).length > 0) {
          supabase.from("customers").update(update).eq("id", id)
            .then(({ error }) => { if (error) console.error("Supabase update customer:", error); });
        }
      },
      deleteCustomer: (id) => {
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
        supabase.from("customers").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete customer:", error); });
        get().logActivity("DELETE_CUSTOMER", "customer", id, `Deleted customer ${id}`);
      },

      addBooking: (b) => {
        if (get().sales.some((sale) => sale.plotId === b.plotId) || get().plots.find((plot) => plot.id === b.plotId)?.status === "sold") {
          throw new Error("A sold plot cannot be booked.");
        }
        if (get().bookings.some((booking) => booking.plotId === b.plotId && ["active", "converted"].includes(booking.status))) {
          throw new Error("This plot already has an active booking. Edit the existing booking instead.");
        }
        const id = uid("b");
        // Generate reference code: ProjectFirst3Words-Block-PlotNo-Facing
        const plot = get().plots.find((p) => p.id === b.plotId);
        const project = plot ? get().projects.find((pr) => pr.id === plot.projectId) : undefined;
        const referenceCode = plot && project
          ? generateReferenceCode(project.name, plot.block, plot.plotNumber, plot.facing)
          : undefined;
        const booking: Booking = {
          ...b, id, referenceCode, status: b.status ?? "active",
          originalPricePerUnit: b.originalPricePerUnit ?? plot?.pricePerCent,
          originalPlotPrice: b.originalPlotPrice ?? plot?.totalPrice,
          originalPlotSize: b.originalPlotSize ?? plot?.size,
          createdAt: nowISO(), updatedAt: nowISO(),
        };
        set((s) => ({ bookings: [booking, ...s.bookings] }));
        // Record the advance as the 1st payment
        const paymentId = uid("pay");
        const payment: Payment = {
          id: paymentId,
          plotId: b.plotId,
          customerId: b.customerId,
          bookingId: id,
          date: b.bookingDate,
          amount: b.advancePaid,
          paymentMode: b.paymentMethod,
          remarks: "Booking advance (1st payment)",
          createdAt: nowISO(),
        };
        set((s) => ({ payments: [payment, ...s.payments] }));
        // Write to Supabase
        supabase.from("bookings").insert({
          id, plot_id: b.plotId, customer_id: b.customerId, reference_code: referenceCode,
          booking_date: b.bookingDate, advance_paid: b.advancePaid, discount: b.discount ?? 0,
          payment_method: b.paymentMethod,
          expected_registration_date: b.expectedRegistrationDate, booking_expiry: b.bookingExpiry,
          status: b.status ?? "active", remarks: b.remarks,
          original_price_per_unit: booking.originalPricePerUnit,
          original_plot_price: booking.originalPlotPrice,
          original_plot_size: booking.originalPlotSize,
        }).then(({ error }) => { if (error) console.error("Supabase booking:", error); });
        supabase.from("payments").insert({
          id: paymentId, plot_id: b.plotId, customer_id: b.customerId, booking_id: id,
          date: b.bookingDate, amount: b.advancePaid, payment_mode: b.paymentMethod,
          remarks: "Booking advance (1st payment)",
        }).then(({ error }) => { if (error) console.error("Supabase payment:", error); });
        // Payment threshold: > ₹50,000 total → reserved, ≤ ₹50,000 → booked
        // (uses centralized RESERVE_THRESHOLD from format.ts)
        const plotStatus = b.advancePaid >= RESERVE_THRESHOLD ? "reserved" : "booked";
        get().setPlotStatus(b.plotId, plotStatus, b.customerId, id);
        // Generate customer reference code (VSF-A-1-S format) — only after first booking
        const customer = get().customers.find((c) => c.id === b.customerId);
        if (customer && !customer.referenceCode) {
          get().updateCustomer(b.customerId, { referenceCode, hasBooking: true });
        }
        get().logActivity("CREATE_BOOKING", "booking", id, `Booked plot ${b.plotId} with ₹${b.advancePaid} advance — ${plotStatus} — ref ${referenceCode}`);
        return id;
      },
      updateBooking: (id, patch) => {
        const existingBooking = get().bookings.find((b) => b.id === id);
        set((s) => ({
          bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: nowISO() } : b)),
        }));
        const update: Record<string, unknown> = {};
        if (patch.bookingDate !== undefined) update.booking_date = patch.bookingDate;
        if (patch.advancePaid !== undefined) update.advance_paid = patch.advancePaid;
        if (patch.discount !== undefined) update.discount = patch.discount;
        if (patch.paymentMethod !== undefined) update.payment_method = patch.paymentMethod;
        if (patch.expectedRegistrationDate !== undefined) update.expected_registration_date = patch.expectedRegistrationDate;
        if (patch.bookingExpiry !== undefined) update.booking_expiry = patch.bookingExpiry;
        if (patch.status !== undefined) update.status = patch.status;
        if (patch.remarks !== undefined) update.remarks = patch.remarks;
        if (Object.keys(update).length > 0) {
          supabase.from("bookings").update(update).eq("id", id)
            .then(({ error }) => { if (error) console.error("Supabase update booking:", error); });
        }
        // If advancePaid changed, also update the auto-created advance payment
        // (the 1st payment with bookingId === id and remarks "Booking advance (1st payment)")
        if (patch.advancePaid !== undefined && existingBooking) {
          const advancePayment = get().payments.find(
            (p) => p.bookingId === id && p.remarks === "Booking advance (1st payment)"
          );
          if (advancePayment) {
            set((s) => ({
              payments: s.payments.map((p) =>
                p.id === advancePayment.id ? { ...p, amount: patch.advancePaid! } : p
              ),
            }));
            supabase.from("payments").update({ amount: patch.advancePaid }).eq("id", advancePayment.id)
              .then(({ error }) => { if (error) console.error("Supabase update advance payment:", error); });
          }
          // Recompute plot status from updated total payments
          if (existingBooking.plotId) get().recalcPlotStatus(existingBooking.plotId);
        }
      },
      deleteBooking: (id) => {
        const b = get().bookings.find((x) => x.id === id);
        set((s) => ({ bookings: s.bookings.filter((x) => x.id !== id) }));
        supabase.from("bookings").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete booking:", error); });
        if (b) {
          get().setPlotStatus(b.plotId, "available", null, null);
          // Per business rule: when a booking is cancelled/taken back, ALL
          // amounts paid against that plot/booking must be reversed in the
          // Payments page as negative-amount rows (rendered in red) with a
          // "Booking taken back" / "Cancelled booking" remark. We create one
          // reversal row per original positive payment so the audit trail
          // clearly mirrors each payment that was taken back. The plot
          // details panel, however, erases the entire payment history (see
          // PlotDetailsPanel) — only the Payments page preserves the audit.
          const remark = b.status === "cancelled" ? "Cancelled booking" : "Booking taken back";
          const positivePayments = get().payments.filter(
            (p) => p.plotId === b.plotId && p.amount > 0
          );
          // If no per-plot payments exist (edge case where payments weren't
          // tied to plotId), fall back to reversing the booking advance.
          const toReverse = positivePayments.length > 0
            ? positivePayments
            : (b.advancePaid ? [{
                id: "advance",
                plotId: b.plotId,
                customerId: b.customerId,
                bookingId: id,
                date: b.bookingDate,
                amount: b.advancePaid,
                paymentMode: b.paymentMethod,
                remarks: "Booking advance (1st payment)",
                createdAt: b.createdAt,
              } as Payment] : []);
          const reversals: Payment[] = toReverse.map((orig) => ({
            id: uid("pay"),
            plotId: b.plotId,
            customerId: b.customerId,
            bookingId: id,
            date: nowISO(),
            amount: -Math.abs(orig.amount),
            paymentMode: orig.paymentMode,
            remarks: remark,
            createdAt: nowISO(),
          }));
          if (reversals.length > 0) {
            set((s) => ({ payments: [...reversals, ...s.payments] }));
            const rows = reversals.map((r) => ({
              id: r.id, plot_id: r.plotId, customer_id: r.customerId, booking_id: r.bookingId,
              date: r.date, amount: r.amount, payment_mode: r.paymentMode, remarks: r.remarks,
            }));
            supabase.from("payments").insert(rows)
              .then(({ error }) => { if (error) console.error("Supabase reversal payments:", error); });
            const totalReversed = reversals.reduce((sum, r) => sum + Math.abs(r.amount), 0);
            get().logActivity("DELETE_BOOKING", "booking", id, `Booking ${b.referenceCode ?? id} taken back — ${reversals.length} payment(s) reversed totalling ₹${totalReversed}.`);
          } else {
            get().logActivity("DELETE_BOOKING", "booking", id, `Booking ${b.referenceCode ?? id} taken back — no payments to reverse.`);
          }
        }
      },

      addSale: (s_) => {
        const existingSale = get().sales.find((sale) => sale.plotId === s_.plotId);
        if (existingSale || get().plots.find((plot) => plot.id === s_.plotId)?.status === "sold") {
          throw new Error("This plot already has a sale record. Edit the existing sale instead.");
        }
        const id = uid("s");
        // Generate reference code: ProjectFirst3Words-Block-PlotNo-Facing
        const plot = get().plots.find((p) => p.id === s_.plotId);
        const project = plot ? get().projects.find((pr) => pr.id === plot.projectId) : undefined;
        const referenceCode = plot && project
          ? generateReferenceCode(project.name, plot.block, plot.plotNumber, plot.facing)
          : undefined;
        const agent = s_.marketingAgentId ? get().marketingAgents.find((a) => a.id === s_.marketingAgentId) : undefined;
        const cadre = agent ? get().marketingCadres.find((c) => c.id === agent.cadreId) : undefined;
        // Snapshots are intentionally written once. Changing current plot/cadre prices
        // later never recalculates a completed transaction or its commission.
        const commissionPercentage = s_.commissionPercentage ?? cadre?.commissionPercentage;
        // COMMISSION RULE: commission is computed on the plot's BASE PRICE
        // (the snapshot of the plot's listed price at sale time), NOT on the
        // total sale value. Discounts, booking amounts, and any extras do not
        // affect the agent's commission. This matches the user's business rule.
        const basePrice = s_.originalPlotPrice ?? plot?.totalPrice ?? 0;
        const sale: Sale = {
          ...s_, id, referenceCode,
          bookingId: s_.bookingId ?? plot?.bookingId,
          originalPricePerUnit: s_.originalPricePerUnit ?? plot?.pricePerCent,
          originalPlotPrice: basePrice,
          bookingAmountSnapshot: s_.bookingAmountSnapshot ?? (plot?.bookingId ? get().bookings.find((b) => b.id === plot.bookingId)?.advancePaid : undefined),
          commissionPercentage,
          commissionAmount: s_.commissionAmount ?? (commissionPercentage !== undefined ? Math.round(basePrice * commissionPercentage) / 100 : undefined),
          commissionStatus: s_.commissionStatus ?? (agent ? "pending" : undefined),
          createdAt: nowISO(), updatedAt: nowISO(),
        };
        set((s) => ({ sales: [sale, ...s.sales] }));
        supabase.from("sales").insert({
          id, plot_id: s_.plotId, customer_id: s_.customerId, reference_code: referenceCode,
          sale_date: s_.saleDate, registration_number: s_.registrationNumber, sale_amount: s_.saleAmount,
          discount: s_.discount, registration_office: s_.registrationOffice, executive_name: s_.executiveName,
          payment_method: s_.paymentMethod, balance_amount: s_.balanceAmount, remarks: s_.remarks,
          marketing_agent_id: sale.marketingAgentId, booking_id: sale.bookingId,
          original_price_per_unit: sale.originalPricePerUnit, original_plot_price: sale.originalPlotPrice,
          booking_amount_snapshot: sale.bookingAmountSnapshot, commission_percentage: sale.commissionPercentage,
          commission_amount: sale.commissionAmount, commission_status: sale.commissionStatus,
        }).then(({ error }) => { if (error) console.error("Supabase sale:", error); });
        // Auto-update plot status to sold
        get().setPlotStatus(s_.plotId, "sold", s_.customerId, undefined, id);
        get().logActivity("CREATE_SALE", "sale", id, `Sold plot ${s_.plotId} for ₹${s_.saleAmount} — ref ${referenceCode}`);
        return id;
      },
      updateSale: (id, patch) => {
        set((s) => ({
          sales: s.sales.map((sa) => (sa.id === id ? { ...sa, ...patch, updatedAt: nowISO() } : sa)),
        }));
        const update: Record<string, unknown> = {};
        if (patch.saleDate !== undefined) update.sale_date = patch.saleDate;
        if (patch.registrationNumber !== undefined) update.registration_number = patch.registrationNumber;
        if (patch.saleAmount !== undefined) update.sale_amount = patch.saleAmount;
        if (patch.discount !== undefined) update.discount = patch.discount;
        if (patch.registrationOffice !== undefined) update.registration_office = patch.registrationOffice;
        if (patch.executiveName !== undefined) update.executive_name = patch.executiveName;
        if (patch.paymentMethod !== undefined) update.payment_method = patch.paymentMethod;
        if (patch.balanceAmount !== undefined) update.balance_amount = patch.balanceAmount;
        if (patch.remarks !== undefined) update.remarks = patch.remarks;
        if (patch.marketingAgentId !== undefined) update.marketing_agent_id = patch.marketingAgentId;
        if (patch.originalPlotPrice !== undefined) update.original_plot_price = patch.originalPlotPrice;
        if (patch.originalPricePerUnit !== undefined) update.original_price_per_unit = patch.originalPricePerUnit;
        if (patch.bookingAmountSnapshot !== undefined) update.booking_amount_snapshot = patch.bookingAmountSnapshot;
        if (patch.commissionPercentage !== undefined) update.commission_percentage = patch.commissionPercentage;
        if (patch.commissionAmount !== undefined) update.commission_amount = patch.commissionAmount;
        if (patch.commissionStatus !== undefined) update.commission_status = patch.commissionStatus;
        if (Object.keys(update).length > 0) {
          supabase.from("sales").update(update).eq("id", id)
            .then(({ error }) => { if (error) console.error("Supabase update sale:", error); });
        }
      },
      deleteSale: (id) => {
        const sa = get().sales.find((x) => x.id === id);
        set((s) => ({ sales: s.sales.filter((x) => x.id !== id) }));
        supabase.from("sales").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete sale:", error); });
        if (sa) get().setPlotStatus(sa.plotId, "available", null, null, null);
      },

      addMarketingCadre: (cadre) => {
        const id = uid("cadre");
        const value: MarketingCadre = { ...cadre, id, createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ marketingCadres: [...s.marketingCadres, value] }));
        supabase.from("marketing_cadres").insert({ id, name: value.name, commission_percentage: value.commissionPercentage, priority: value.priority, icon: value.icon, active: value.active })
          .then(({ error }) => { if (error) console.error("Supabase marketing cadre:", error); });
        return id;
      },
      updateMarketingCadre: (id, patch) => {
        set((s) => ({ marketingCadres: s.marketingCadres.map((c) => c.id === id ? { ...c, ...patch, updatedAt: nowISO() } : c) }));
        const update: Record<string, unknown> = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.commissionPercentage !== undefined) update.commission_percentage = patch.commissionPercentage;
        if (patch.priority !== undefined) update.priority = patch.priority;
        if (patch.icon !== undefined) update.icon = patch.icon;
        if (patch.active !== undefined) update.active = patch.active;
        supabase.from("marketing_cadres").update(update).eq("id", id).then(({ error }) => { if (error) console.error("Supabase marketing cadre update:", error); });
      },
      archiveMarketingCadre: (id) => {
        if (get().marketingAgents.some((agent) => agent.cadreId === id && agent.status !== "archived")) throw new Error("Reassign or archive agents before archiving this cadre.");
        get().updateMarketingCadre(id, { active: false });
      },
      deleteMarketingCadre: (id) => {
        if (get().marketingAgents.some((agent) => agent.cadreId === id && agent.status !== "archived")) throw new Error("Reassign or delete agents before deleting this cadre.");
        if (get().sales.some((sale) => sale.marketingAgentId && get().marketingAgents.find((a) => a.id === sale.marketingAgentId)?.cadreId === id)) throw new Error("This cadre has agents linked to historical sales and cannot be deleted. Archive it instead.");
        set((s) => ({ marketingCadres: s.marketingCadres.filter((c) => c.id !== id) }));
        supabase.from("marketing_cadres").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete cadre:", error); });
      },
      addMarketingAgent: (agent) => {
        if (get().marketingAgents.some((item) => item.employeeId.toLowerCase() === agent.employeeId.toLowerCase())) throw new Error("An agent with this Employee/Agent ID already exists.");
        const id = uid("agent");
        const value: MarketingAgent = { ...agent, id, createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ marketingAgents: [value, ...s.marketingAgents] }));
        supabase.from("marketing_agents").insert({ id, full_name: value.fullName, phone: value.phone, employee_id: value.employeeId, joining_date: value.joiningDate, profile_photo: value.profilePhoto, email: value.email, address: value.address, cadre_id: value.cadreId, status: value.status, notes: value.notes })
          .then(({ error }) => { if (error) console.error("Supabase marketing agent:", error); });
        return id;
      },
      updateMarketingAgent: (id, patch) => {
        set((s) => ({ marketingAgents: s.marketingAgents.map((a) => a.id === id ? { ...a, ...patch, updatedAt: nowISO() } : a) }));
        const update: Record<string, unknown> = {};
        if (patch.fullName !== undefined) update.full_name = patch.fullName;
        if (patch.phone !== undefined) update.phone = patch.phone;
        if (patch.employeeId !== undefined) update.employee_id = patch.employeeId;
        if (patch.joiningDate !== undefined) update.joining_date = patch.joiningDate;
        if (patch.profilePhoto !== undefined) update.profile_photo = patch.profilePhoto;
        if (patch.email !== undefined) update.email = patch.email;
        if (patch.address !== undefined) update.address = patch.address;
        if (patch.cadreId !== undefined) update.cadre_id = patch.cadreId;
        if (patch.status !== undefined) update.status = patch.status;
        if (patch.notes !== undefined) update.notes = patch.notes;
        supabase.from("marketing_agents").update(update).eq("id", id).then(({ error }) => { if (error) console.error("Supabase marketing agent update:", error); });
      },
      archiveMarketingAgent: (id) => get().updateMarketingAgent(id, { status: "archived" }),
      deleteMarketingAgent: (id) => {
        // Hard-delete is allowed only if the agent has no historical sales
        // (either finance sales linked via marketingAgentId OR independent
        // marketing sales). Otherwise we ask the user to archive instead so
        // the commission history is preserved.
        if (get().sales.some((sale) => sale.marketingAgentId === id)) throw new Error("This agent is linked to historical finance sales and cannot be deleted. Archive it instead to preserve commission history.");
        if (get().marketingSales.some((sale) => sale.agentId === id)) throw new Error("This agent is linked to historical marketing sales and cannot be deleted. Archive it instead to preserve commission history.");
        set((s) => ({ marketingAgents: s.marketingAgents.filter((a) => a.id !== id), marketingExpenses: s.marketingExpenses.filter((e) => e.agentId !== id), commissionPayouts: s.commissionPayouts.filter((p) => p.agentId !== id), marketingSales: s.marketingSales.filter((m) => m.agentId !== id) }));
        supabase.from("marketing_sales").delete().eq("agent_id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete agent marketing sales:", error); });
        supabase.from("commission_payouts").delete().eq("agent_id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete agent payouts:", error); });
        supabase.from("marketing_expenses").delete().eq("agent_id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete agent expenses:", error); });
        supabase.from("marketing_agents").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete agent:", error); });
      },
      addMarketingExpense: (expense) => {
        const id = uid("expense");
        const value: MarketingExpense = { ...expense, id, createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ marketingExpenses: [value, ...s.marketingExpenses] }));
        supabase.from("marketing_expenses").insert({ id, agent_id: value.agentId, category: value.category, amount: value.amount, date: value.date, description: value.description, project_id: value.projectId, receipt_url: value.receiptUrl, status: value.status })
          .then(({ error }) => { if (error) console.error("Supabase marketing expense:", error); });
        return id;
      },
      updateMarketingExpense: (id, patch) => {
        set((s) => ({ marketingExpenses: s.marketingExpenses.map((e) => e.id === id ? { ...e, ...patch, updatedAt: nowISO() } : e) }));
        const update: Record<string, unknown> = {};
        if (patch.agentId !== undefined) update.agent_id = patch.agentId;
        if (patch.category !== undefined) update.category = patch.category;
        if (patch.amount !== undefined) update.amount = patch.amount;
        if (patch.date !== undefined) update.date = patch.date;
        if (patch.description !== undefined) update.description = patch.description;
        if (patch.projectId !== undefined) update.project_id = patch.projectId;
        if (patch.receiptUrl !== undefined) update.receipt_url = patch.receiptUrl;
        if (patch.status !== undefined) update.status = patch.status;
        supabase.from("marketing_expenses").update(update).eq("id", id).then(({ error }) => { if (error) console.error("Supabase marketing expense update:", error); });
      },
      deleteMarketingExpense: (id) => {
        set((s) => ({ marketingExpenses: s.marketingExpenses.filter((e) => e.id !== id) }));
        supabase.from("marketing_expenses").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete expense:", error); });
      },
      addMarketingSale: (sale) => {
        const id = uid("msale");
        const value: MarketingSale = { ...sale, id, createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ marketingSales: [value, ...s.marketingSales] }));
        supabase.from("marketing_sales").insert({
          id, agent_id: value.agentId, plot_id: value.plotId ?? null, customer_id: value.customerId ?? null,
          reference_code: value.referenceCode, sale_date: value.saleDate,
          extra_discount_from_commission: value.extraDiscountFromCommission ?? 0,
          base_price: value.basePrice ?? null,
          commission_percentage: value.commissionPercentage ?? null,
          commission_amount: value.commissionAmount ?? null,
          commission_status: value.commissionStatus,
          remarks: value.remarks,
        }).then(({ error }) => { if (error) console.error("Supabase marketing sale:", error); });
        return id;
      },
      updateMarketingSale: (id, patch) => {
        set((s) => ({ marketingSales: s.marketingSales.map((m) => m.id === id ? { ...m, ...patch, updatedAt: nowISO() } : m) }));
        const update: Record<string, unknown> = {};
        if (patch.agentId !== undefined) update.agent_id = patch.agentId;
        if (patch.plotId !== undefined) update.plot_id = patch.plotId;
        if (patch.customerId !== undefined) update.customer_id = patch.customerId;
        if (patch.referenceCode !== undefined) update.reference_code = patch.referenceCode;
        if (patch.saleDate !== undefined) update.sale_date = patch.saleDate;
        if (patch.extraDiscountFromCommission !== undefined) update.extra_discount_from_commission = patch.extraDiscountFromCommission;
        if (patch.basePrice !== undefined) update.base_price = patch.basePrice;
        if (patch.remarks !== undefined) update.remarks = patch.remarks;
        if (patch.commissionPercentage !== undefined) update.commission_percentage = patch.commissionPercentage;
        if (patch.commissionAmount !== undefined) update.commission_amount = patch.commissionAmount;
        if (patch.commissionStatus !== undefined) update.commission_status = patch.commissionStatus;
        supabase.from("marketing_sales").update(update).eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase marketing sale update:", error); });
      },
      deleteMarketingSale: (id) => {
        set((s) => ({ marketingSales: s.marketingSales.filter((m) => m.id !== id) }));
        supabase.from("marketing_sales").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete marketing sale:", error); });
      },
      addCommissionPayout: (payout) => {
        const id = uid("payout");
        const value: CommissionPayout = { ...payout, id, createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ commissionPayouts: [value, ...s.commissionPayouts] }));
        supabase.from("commission_payouts").insert({ id, agent_id: value.agentId, amount: value.amount, payment_date: value.paymentDate, payment_reference: value.paymentReference, notes: value.notes, status: value.status })
          .then(({ error }) => { if (error) console.error("Supabase commission payout:", error); });
        return id;
      },
      updateCommissionPayout: (id, patch) => {
        set((s) => ({ commissionPayouts: s.commissionPayouts.map((p) => p.id === id ? { ...p, ...patch, updatedAt: nowISO() } : p) }));
        const update: Record<string, unknown> = {};
        if (patch.agentId !== undefined) update.agent_id = patch.agentId;
        if (patch.amount !== undefined) update.amount = patch.amount;
        if (patch.paymentDate !== undefined) update.payment_date = patch.paymentDate;
        if (patch.paymentReference !== undefined) update.payment_reference = patch.paymentReference;
        if (patch.notes !== undefined) update.notes = patch.notes;
        if (patch.status !== undefined) update.status = patch.status;
        supabase.from("commission_payouts").update(update).eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase payout update:", error); });
      },
      deleteCommissionPayout: (id) => {
        set((s) => ({ commissionPayouts: s.commissionPayouts.filter((p) => p.id !== id) }));
        supabase.from("commission_payouts").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete payout:", error); });
      },
      updateMarketingPerformanceSettings: (patch) => {
        set((s) => ({ marketingPerformanceSettings: { ...s.marketingPerformanceSettings, ...patch } }));
        const update: Record<string, unknown> = {};
        if (patch.salesVolumeWeight !== undefined) update.sales_volume_weight = patch.salesVolumeWeight;
        if (patch.revenueWeight !== undefined) update.revenue_weight = patch.revenueWeight;
        if (patch.plotsSoldWeight !== undefined) update.plots_sold_weight = patch.plotsSoldWeight;
        if (patch.conversionRateWeight !== undefined) update.conversion_rate_weight = patch.conversionRateWeight;
        supabase.from("marketing_settings").update(update).eq("id", 1).then(({ error }) => { if (error) console.error("Supabase marketing settings update:", error); });
      },

      addPayment: (p) => {
        const id = uid("pay");
        const payment: Payment = { ...p, id, createdAt: nowISO() };
        set((s) => ({ payments: [payment, ...s.payments] }));
        supabase.from("payments").insert({
          id, plot_id: p.plotId, customer_id: p.customerId, booking_id: p.bookingId, sale_id: p.saleId,
          date: p.date, amount: p.amount, payment_mode: p.paymentMode,
          reference_number: p.referenceNumber, bank: p.bank, cheque_number: p.chequeNumber,
          transaction_id: p.transactionId, remarks: p.remarks,
        }).then(({ error }) => { if (error) console.error("Supabase payment:", error); });

        // Recompute plot status from accumulated payments (₹50k rule)
        if (p.plotId) get().recalcPlotStatus(p.plotId);
        get().logActivity("RECEIVE_PAYMENT", "payment", id, `Received payment of ₹${p.amount}`);
        return id;
      },
      updatePayment: (id, patch) => {
        const existing = get().payments.find((p) => p.id === id);
        set((s) => ({
          payments: s.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
        const update: Record<string, unknown> = {};
        if (patch.date !== undefined) update.date = patch.date;
        if (patch.amount !== undefined) update.amount = patch.amount;
        if (patch.paymentMode !== undefined) update.payment_mode = patch.paymentMode;
        if (patch.referenceNumber !== undefined) update.reference_number = patch.referenceNumber;
        if (patch.bank !== undefined) update.bank = patch.bank;
        if (patch.chequeNumber !== undefined) update.cheque_number = patch.chequeNumber;
        if (patch.transactionId !== undefined) update.transaction_id = patch.transactionId;
        if (patch.remarks !== undefined) update.remarks = patch.remarks;
        if (Object.keys(update).length > 0) {
          supabase.from("payments").update(update).eq("id", id)
            .then(({ error }) => { if (error) console.error("Supabase update payment:", error); });
        }
        // Recompute status for both old and new plot (in case plotId or amount changed)
        if (existing?.plotId) get().recalcPlotStatus(existing.plotId);
        if (patch.plotId && patch.plotId !== existing?.plotId) get().recalcPlotStatus(patch.plotId);
      },
      deletePayment: (id) => {
        const p = get().payments.find((x) => x.id === id);
        set((s) => ({ payments: s.payments.filter((x) => x.id !== id) }));
        supabase.from("payments").delete().eq("id", id)
          .then(({ error }) => { if (error) console.error("Supabase delete payment:", error); });
        // Recompute plot status (may downgrade reserved → booked if total drops below threshold)
        if (p?.plotId) get().recalcPlotStatus(p.plotId);
      },

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        const update: Record<string, unknown> = {};
        if (patch.companyName !== undefined) update.company_name = patch.companyName;
        if (patch.companyLogo !== undefined) update.company_logo = patch.companyLogo;
        if (patch.gst !== undefined) update.gst = patch.gst;
        if (patch.address !== undefined) update.address = patch.address;
        if (patch.phone !== undefined) update.phone = patch.phone;
        if (patch.email !== undefined) update.email = patch.email;
        if (patch.bankDetails) {
          if (patch.bankDetails.bankName !== undefined) update.bank_name = patch.bankDetails.bankName;
          if (patch.bankDetails.accountName !== undefined) update.account_name = patch.bankDetails.accountName;
          if (patch.bankDetails.accountNumber !== undefined) update.account_number = patch.bankDetails.accountNumber;
          if (patch.bankDetails.ifsc !== undefined) update.ifsc = patch.bankDetails.ifsc;
          if (patch.bankDetails.branch !== undefined) update.branch = patch.bankDetails.branch;
        }
        if (patch.upi !== undefined) update.upi = patch.upi;
        if (patch.paymentGateway !== undefined) update.payment_gateway = patch.paymentGateway;
        if (Object.keys(update).length > 0) {
          supabase.from("settings").update(update).eq("id", 1)
            .then(({ error }) => { if (error) console.error("Supabase settings:", error); });
        }
        get().logActivity("UPDATE_SETTINGS", "settings", "settings", "Updated company settings");
      },

      addUser: (u) => {
        const id = uid("u");
        const user: User = { ...u, id, createdAt: nowISO() };
        set((s) => ({ users: [...s.users, user] }));
      },
      updateUser: (id, patch) => {
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
        const update: Record<string, unknown> = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.role !== undefined) update.role = patch.role;
        if (patch.active !== undefined) update.active = patch.active;
        if (Object.keys(update).length > 0) {
          supabase.from("user_profiles").update(update).eq("id", id)
            .then(({ error }) => { if (error) console.error("Supabase update user:", error); });
        }
      },
      deleteUser: (id) => {
        set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
        supabase.from("user_profiles").delete().eq("id", id).then(({ error }) => { if (error) console.error("Supabase delete user:", error); });
      },

      logActivity: (action, entity, entityId, details) => {
        const user = get().users.find((u) => u.id === get().currentUserId);
        const entry: ActivityLog = {
          id: uid("al"),
          userId: user?.id,
          userName: user?.name,
          action,
          entity,
          entityId,
          details,
          timestamp: nowISO(),
        };
        set((s) => ({ activityLogs: [entry, ...s.activityLogs].slice(0, 200) }));
        supabase.from("activity_logs").insert({
          id: entry.id, user_id: user?.id, user_name: user?.name,
          action, entity, entity_id: entityId, details,
        }).then(({ error }) => { if (error) console.error("Supabase activity log:", error); });
      },

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      clearNotifications: () => set({ notifications: [] }),

      resetToSeed: () => {
        // Reload everything from Supabase instead of using seed data
        get().loadFromSupabase();
      },

      reloadUsers: async () => {
        const { data } = await supabase.from("user_profiles").select("*");
        if (data) {
          set({
            users: data.map((r: Record<string, unknown>) => ({
              id: r.id, name: r.name, email: r.email, role: r.role, active: r.active,
              createdAt: r.created_at,
            })) as User[],
          });
        }
      },

      isSupabaseLoading: false,
      loadFromSupabase: async () => {
        set({ isSupabaseLoading: true });
        try {
          const [
            { data: projects }, { data: layouts }, { data: plots },
            { data: customers }, { data: bookings }, { data: sales },
            { data: payments }, { data: settingsData }, { data: activityLogs }, { data: userProfiles },
            { data: marketingCadres }, { data: marketingAgents }, { data: marketingExpenses }, { data: commissionPayouts }, { data: marketingSettings },
            { data: marketingSalesRows },
          ] = await Promise.all([
            supabase.from("projects").select("*"),
            supabase.from("layouts").select("*"),
            supabase.from("plots").select("*"),
            supabase.from("customers").select("*"),
            supabase.from("bookings").select("*"),
            supabase.from("sales").select("*"),
            supabase.from("payments").select("*"),
            supabase.from("settings").select("*").eq("id", 1).single(),
            supabase.from("activity_logs").select("*").order("timestamp", { ascending: false }).limit(200),
            supabase.from("user_profiles").select("*"),
            supabase.from("marketing_cadres").select("*").order("priority", { ascending: true }),
            supabase.from("marketing_agents").select("*").order("created_at", { ascending: false }),
            supabase.from("marketing_expenses").select("*").order("date", { ascending: false }),
            supabase.from("commission_payouts").select("*").order("created_at", { ascending: false }),
            supabase.from("marketing_settings").select("*").eq("id", 1).single(),
            supabase.from("marketing_sales").select("*").order("sale_date", { ascending: false }),
          ]);

          set({
            projects: (projects || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, name: r.name as string, location: r.location as string,
              totalArea: r.total_area as string, numberOfPlots: r.number_of_plots as number,
              layoutImage: r.layout_image as string, status: r.status as Project["status"],
              description: r.description as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
              isDeleted: (r.is_deleted as boolean) ?? false,
              deletedAt: r.deleted_at as string | undefined,
              deletedBy: r.deleted_by as string | undefined,
            })) as Project[],
            layouts: (layouts || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, projectId: r.project_id as string, name: r.name as string,
              image: r.image as string, description: r.description as string,
              numberOfPlots: r.number_of_plots as number, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as Layout[],
            plots: (plots || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, layoutId: r.layout_id as string, projectId: r.project_id as string,
              plotNumber: r.plot_number as string, block: r.block as string, size: r.size as number,
              sizeUnit: r.size_unit as Plot["sizeUnit"], facing: r.facing as Plot["facing"],
              pricePerCent: r.price_per_cent as number, totalPrice: r.total_price as number,
              basePricePerUnit: (r.base_price_per_unit as number | null | undefined) ?? undefined,
              frozenPrice: (r.frozen_price as FrozenPrice | null | undefined) ?? undefined,
              status: r.status as PlotStatus, cornerPlot: r.corner_plot as boolean,
              roadWidth: r.road_width as number, notes: r.notes as string,
              x: r.x as number, y: r.y as number, width: r.width as number, height: r.height as number,
              customerId: r.customer_id as string, bookingId: r.booking_id as string, saleId: r.sale_id as string,
              createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as Plot[],
            customers: (customers || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, name: r.name as string, fatherName: r.father_name as string,
              motherName: r.mother_name as string, phone: r.phone as string,
              alternatePhone: r.alternate_phone as string, email: r.email as string,
              address: r.address as string, city: r.city as string, state: r.state as string,
              pinCode: r.pin_code as string, occupation: r.occupation as string,
              pan: r.pan as string, aadhaar: r.aadhaar as string, photo: r.photo as string,
              remarks: r.remarks as string, referenceCode: r.reference_code as string,
              hasBooking: r.has_booking as boolean,
              createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as Customer[],
            bookings: (bookings || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, plotId: r.plot_id as string, customerId: r.customer_id as string,
              referenceCode: r.reference_code as string, bookingDate: r.booking_date as string,
              advancePaid: r.advance_paid as number, discount: (r.discount as number) ?? 0,
              originalPricePerUnit: r.original_price_per_unit as number,
              originalPlotPrice: r.original_plot_price as number,
              originalPlotSize: r.original_plot_size as number,
              paymentMethod: r.payment_method as Payment["paymentMode"],
              expectedRegistrationDate: r.expected_registration_date as string,
              bookingExpiry: r.booking_expiry as string, status: r.status as string,
              remarks: r.remarks as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as Booking[],
            sales: (sales || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, plotId: r.plot_id as string, customerId: r.customer_id as string,
              referenceCode: r.reference_code as string, saleDate: r.sale_date as string,
              registrationNumber: r.registration_number as string, saleAmount: r.sale_amount as number,
              discount: r.discount as number, registrationOffice: r.registration_office as string,
              executiveName: r.executive_name as string, paymentMethod: r.payment_method as Payment["paymentMode"],
              balanceAmount: r.balance_amount as number, remarks: r.remarks as string,
              marketingAgentId: r.marketing_agent_id as string, bookingId: r.booking_id as string,
              originalPricePerUnit: r.original_price_per_unit as number, originalPlotPrice: r.original_plot_price as number,
              bookingAmountSnapshot: r.booking_amount_snapshot as number,
              commissionPercentage: r.commission_percentage as number, commissionAmount: r.commission_amount as number,
              commissionStatus: r.commission_status as Sale["commissionStatus"],
              createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as Sale[],
            payments: (payments || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, plotId: r.plot_id as string, customerId: r.customer_id as string,
              bookingId: r.booking_id as string, saleId: r.sale_id as string,
              date: r.date as string, amount: r.amount as number,
              paymentMode: r.payment_mode as Payment["paymentMode"],
              referenceNumber: r.reference_number as string, bank: r.bank as string,
              chequeNumber: r.cheque_number as string, transactionId: r.transaction_id as string,
              remarks: r.remarks as string, createdAt: r.created_at as string,
            })) as Payment[],
            settings: settingsData ? {
              companyName: settingsData.company_name as string,
              companyLogo: settingsData.company_logo as string,
              gst: settingsData.gst as string, address: settingsData.address as string,
              phone: settingsData.phone as string, email: settingsData.email as string,
              bankDetails: {
                bankName: settingsData.bank_name as string,
                accountName: settingsData.account_name as string,
                accountNumber: settingsData.account_number as string,
                ifsc: settingsData.ifsc as string,
                branch: settingsData.branch as string,
              },
              upi: settingsData.upi as string,
              paymentGateway: settingsData.payment_gateway as string,
            } as CompanySettings : seedSettings,
            activityLogs: (activityLogs || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, userId: r.user_id as string, userName: r.user_name as string,
              action: r.action as string, entity: r.entity as string, entityId: r.entity_id as string,
              details: r.details as string, timestamp: r.timestamp as string,
            })) as ActivityLog[],
            users: (userProfiles || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, name: r.name as string, email: r.email as string, role: r.role as UserRole, active: r.active as boolean, createdAt: r.created_at as string,
            })) as User[],
            marketingCadres: (marketingCadres || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, name: r.name as string, commissionPercentage: Number(r.commission_percentage),
              priority: Number(r.priority), icon: r.icon as MarketingCadre["icon"], active: r.active as boolean,
              createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as MarketingCadre[],
            marketingAgents: (marketingAgents || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, fullName: r.full_name as string, phone: r.phone as string,
              employeeId: r.employee_id as string, joiningDate: r.joining_date as string,
              profilePhoto: r.profile_photo as string, email: r.email as string, address: r.address as string,
              cadreId: r.cadre_id as string, status: r.status as MarketingAgent["status"], notes: r.notes as string,
              createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as MarketingAgent[],
            marketingExpenses: (marketingExpenses || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, agentId: r.agent_id as string, category: r.category as string,
              amount: Number(r.amount), date: r.date as string, description: r.description as string,
              projectId: r.project_id as string, receiptUrl: r.receipt_url as string,
              status: r.status as MarketingExpense["status"], createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as MarketingExpense[],
            commissionPayouts: (commissionPayouts || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, agentId: r.agent_id as string, amount: Number(r.amount),
              paymentDate: r.payment_date as string, paymentReference: r.payment_reference as string,
              notes: r.notes as string, status: r.status as CommissionPayout["status"],
              createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as CommissionPayout[],
            marketingSales: (marketingSalesRows || []).map((r: Record<string, unknown>) => ({
              id: r.id as string, agentId: r.agent_id as string, plotId: (r.plot_id as string) ?? undefined,
              customerId: (r.customer_id as string) ?? undefined, referenceCode: r.reference_code as string,
              saleDate: r.sale_date as string,
              extraDiscountFromCommission: r.extra_discount_from_commission !== null && r.extra_discount_from_commission !== undefined ? Number(r.extra_discount_from_commission) : 0,
              basePrice: r.base_price !== null && r.base_price !== undefined ? Number(r.base_price) : undefined,
              remarks: r.remarks as string,
              commissionPercentage: r.commission_percentage !== null && r.commission_percentage !== undefined ? Number(r.commission_percentage) : undefined,
              commissionAmount: r.commission_amount !== null && r.commission_amount !== undefined ? Number(r.commission_amount) : undefined,
              commissionStatus: r.commission_status as MarketingSale["commissionStatus"],
              createdAt: r.created_at as string, updatedAt: r.updated_at as string,
            })) as MarketingSale[],
            marketingPerformanceSettings: marketingSettings ? {
              salesVolumeWeight: Number(marketingSettings.sales_volume_weight),
              revenueWeight: Number(marketingSettings.revenue_weight),
              plotsSoldWeight: Number(marketingSettings.plots_sold_weight),
              conversionRateWeight: Number(marketingSettings.conversion_rate_weight),
            } : { salesVolumeWeight: 40, revenueWeight: 30, plotsSoldWeight: 20, conversionRateWeight: 10 },
          });
          // Local state updates optimistically for immediate feedback. This subscription
          // keeps every open dashboard in sync after a change from another user.
          if (!realtimeMarketingSubscriptionStarted) {
            realtimeMarketingSubscriptionStarted = true;
            ["marketing_cadres", "marketing_agents", "marketing_expenses", "commission_payouts", "marketing_settings", "marketing_sales", "sales", "bookings", "plots"].forEach((table) => {
              supabase.channel(`crm-live-${table}`).on("postgres_changes", { event: "*", schema: "public", table }, () => {
                if (realtimeMarketingReloadTimer) clearTimeout(realtimeMarketingReloadTimer);
                realtimeMarketingReloadTimer = setTimeout(() => get().loadFromSupabase(), 250);
              }).subscribe();
            });
          }
        } catch (e) {
          console.error("Failed to load from Supabase:", e);
        } finally {
          set({ isSupabaseLoading: false });
        }
      },
    }),
    // NO localStorage persistence — all data comes from Supabase via loadFromSupabase()
);



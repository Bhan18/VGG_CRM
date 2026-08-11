
// ============================================================
// VGG Infra Developers - Real Estate CRM Type Definitions
// Database-agnostic: ready for Firebase, MySQL, Supabase, PostgreSQL
// ============================================================

export type PlotStatus = "available" | "booked" | "reserved" | "sold" | "blocked";

export type UserRole = "administrator" | "sales_manager" | "marketing" | "viewer";

export type PaymentMode =
  | "cash"
  | "cheque"
  | "neft"
  | "rtgs"
  | "upi"
  | "card"
  | "bank_transfer";

export type FacingDirection =
  | "North"
  | "South"
  | "East"
  | "West"
  | "North-East"
  | "North-West"
  | "South-East"
  | "South-West";

export interface Project {
  id: string;
  name: string;
  location: string;
  totalArea: string; // e.g. "12 Acres"
  numberOfPlots: number;
  layoutImage?: string; // base64 or URL
  status: "active" | "planned" | "completed" | "archived";
  description?: string;
  createdAt: string;
  updatedAt: string;
  // Soft-delete / Recycle Bin
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

// Block configuration used by the Add-Project wizard to auto-generate plots.
export interface BlockConfig {
  name: string;            // "A", "B", "C"
  plotRange: string;       // "1-10, 12, 15"
  defaultFacing: FacingDirection;
  cornerPlots: string;     // "1, 10, 15" (plot numbers within this block that are corner plots)
  defaultSize: number;     // in project's areaUnit
  defaultPricePerUnit: number;  // base price per unit (cent or sqyd, depending on project's areaUnit)
  roadWidth: number;       // feet
  // Multi-select facing assignments
  facingAssignments?: Record<number, FacingDirection>;
  // Per-plot size overrides
  sizeOverrides?: Record<number, number>;
  // Per-plot price overrides
  priceOverrides?: Record<number, number>;
}

// Project-level pricing defaults — shared across all blocks
export interface ProjectPricingDefaults {
  areaUnit: "cents" | "sqyd";           // land unit for entire project
  cornerPremium: number;                 // ₹ per unit added for corner plots
  facingPremiums: Partial<Record<FacingDirection, number>>; // ₹ per unit added per facing
}

/**
 * Frozen price snapshot — captured the moment a plot becomes booked/reserved/sold.
 *
 * Stores the layout price as SEPARATE COMPONENTS so:
 *   - Agent commission base = basePricePerUnit × size (no facing, no corner)
 *   - Display total to user = totalPrice (base + facing + corner)
 *
 * See Plot.frozenPrice for the field that holds this snapshot.
 */
export interface FrozenPrice {
  /** Pure base price per unit (₹/cent or ₹/sqyd) — NO facing premium, NO corner premium. */
  basePricePerUnit: number;
  /** Facing premium per unit captured at freeze time. */
  facingPremiumPerUnit: number;
  /** Corner premium per unit captured at freeze time (0 for non-corner plots). */
  cornerPremiumPerUnit: number;
  /** Full per-unit price (base + facing + corner). */
  effectivePricePerUnit: number;
  /** Plot size at freeze time (cents or sqyd, see sizeUnit). */
  size: number;
  /** Size unit at freeze time. */
  sizeUnit: "cents" | "sqyd";
  /** Total plot price = effectivePricePerUnit × size. */
  totalPrice: number;
  /** ISO timestamp when the snapshot was captured. */
  frozenAt: string;
}

export interface Layout {
  id: string;
  projectId: string;
  name: string; // e.g. "Phase 1"
  image?: string; // master layout image (base64 or URL)
  description?: string;
  numberOfPlots: number;
  createdAt: string;
  updatedAt: string;
}

// A plot is positioned over its layout image via percentage coords
// (x, y, width, height in %) so the overlay scales with the image.
export interface Plot {
  id: string;
  layoutId: string;
  projectId: string;
  plotNumber: string;
  block: string; // e.g. "A", "B"
  size: number; // numeric value in sizeUnit
  sizeUnit: "cents" | "sqyd";
  facing: FacingDirection;
  pricePerCent: number;
  totalPrice: number;
  /**
   * Pure base price per unit (₹/cent or ₹/sqyd) WITHOUT facing premium or
   * corner premium. Captured from the layout block's defaultPricePerUnit (or
   * per-plot priceOverride) when the plot is generated. Used by the Agent
   * Sale form as the commission base — facing/corner/extra costs are ignored
   * for agent commission per business rule.
   *
   * For booked / reserved / sold plots, this value is FROZEN at booking time
   * — editing the layout price later will NOT recompute it. Only available
   * plots get their basePricePerUnit refreshed when the layout is re-saved.
   */
  basePricePerUnit?: number;
  /**
   * FROZEN PRICE SNAPSHOT — captured the moment a plot transitions to
   * booked/reserved/sold. Stores the layout price as SEPARATE COMPONENTS
   * (base / facing premium / corner premium / effective / total) so the
   * Agent Sale form can read just `basePricePerUnit × size` for the
   * commission base while still displaying the full total to the user.
   *
   * Business rules:
   *   - Captured ONCE at booking time; never recomputed afterwards.
   *   - Editing the layout price does NOT modify this snapshot (booked/
   *     reserved/sold plots keep their original frozen price).
   *   - When the booking is cancelled/deleted, this snapshot is CLEARED so
   *     the plot reverts to using the live layout price (which may have
   *     changed since the booking was made).
   *   - For plots booked BEFORE this field existed, the snapshot is
   *     auto-populated on first read by reverse-engineering base/facing/
   *     corner premiums from sibling plots in the same project.
   */
  frozenPrice?: FrozenPrice;
  status: PlotStatus;
  cornerPlot: boolean;
  roadWidth: number; // in feet
  notes?: string;
  // Overlay position (percentage of layout image dimensions)
  x: number; // 0-100
  y: number; // 0-100
  width: number; // 0-100
  height: number; // 0-100
  shape?: "rect"; // future: polygon
  customerId?: string; // when reserved/booked/sold
  bookingId?: string;
  saleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  fatherName?: string;
  motherName?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  occupation?: string;
  pan?: string;
  aadhaar?: string;
  photo?: string; // base64
  documents?: { name: string; url: string }[];
  remarks?: string;
  referenceCode?: string; // Generated after first booking (VSF-A-1-S format)
  hasBooking?: boolean; // true once a booking is created for this customer
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  plotId: string;
  customerId: string;
  referenceCode?: string; // e.g. "Vijaya-Sandalwood-Farm-A-5-East"
  bookingDate: string;
  advancePaid: number;
  discount: number; // discount given at booking time (₹) — carried forward to sale
  paymentMethod: PaymentMode;
  expectedRegistrationDate?: string;
  bookingExpiry?: string;
  status: "active" | "expired" | "converted" | "cancelled";
  remarks?: string;
  // Immutable transaction snapshot; never derived from the mutable plot/layout price.
  originalPricePerUnit?: number;
  originalPlotPrice?: number;
  originalPlotSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  plotId: string;
  customerId: string;
  referenceCode?: string; // e.g. "Vijaya-Sandalwood-Farm-A-5-East"
  saleDate: string;
  registrationNumber?: string;
  saleAmount: number;
  discount: number;
  registrationOffice?: string;
  executiveName?: string;
  paymentMethod: PaymentMode;
  balanceAmount: number;
  remarks?: string;
  /** Marketing attribution is optional so legacy sales remain valid. */
  marketingAgentId?: string;
  bookingId?: string;
  originalPricePerUnit?: number;
  originalPlotPrice?: number;
  bookingAmountSnapshot?: number;
  commissionPercentage?: number;
  commissionAmount?: number;
  commissionStatus?: "pending" | "approved" | "paid";
  createdAt: string;
  updatedAt: string;
}

export type AgentStatus = "active" | "inactive" | "suspended" | "archived";
export type ExpenseStatus = "pending_review" | "approved" | "rejected" | "reimbursed" | "deducted_from_commission";
export type PayoutStatus = "pending" | "partially_paid" | "paid" | "on_hold";

/**
 * Marketing sale — REFERENCE-ONLY view of finance data with agent attribution.
 *
 * The Marketing Team page is a reference/records layer on top of finance. It
 * does NOT write back to the finance Sale / Booking / Plot tables. When the
 * finance team changes the price, discount, or sale amount, those changes
 * automatically flow into the marketing view because money fields are looked
 * up at view time from the linked booking / sale / plot.
 *
 * What is STORED on a marketing sale:
 *   - agentId (attribution, includes "Direct Sales" sentinel for company-direct sales)
 *   - plotId, customerId (linkage to finance data)
 *   - saleDate (when the agent closed the deal — for agent history)
 *   - extraDiscountFromCommission (the ONLY money field the marketing team
 *     controls — if the agent gives up part of their commission as an extra
 *     discount, it reduces the commission base)
 *   - commissionPercentage / commissionAmount / commissionStatus (snapshot of
 *     the cadre rate at sale time + lifecycle status)
 *   - remarks
 *
 * What is DERIVED at view time (in MarketingTeamPage.computeMarketingSaleView):
 *   - basePrice          <- booking.originalPlotPrice ?? plot.totalPrice
 *   - saleAmount         <- finance Sale.saleAmount ?? booking.advancePaid ?? 0
 *   - discount           <- finance Sale.discount ?? booking.discount ?? 0
 *   - effectiveCommBase  <- basePrice - extraDiscountFromCommission
 *   - commissionAmount   <- effectiveCommBase * commissionPercentage / 100
 */
export interface MarketingSale {
  id: string;
  /** "direct-sales" sentinel = company-direct sale with no specific agent. */
  agentId: string;
  plotId?: string;
  customerId?: string;
  referenceCode?: string;
  saleDate: string;
  /**
   * Extra discount given from the agent's commission. This is the ONLY money
   * field the marketing team writes. It reduces the commission base, NOT the
   * finance sale amount. Stored so the marketing record survives finance
   * price changes.
   */
  extraDiscountFromCommission?: number;
  /**
   * Commission base snapshot = plot's base price at sale time. Stored for
   * historical display, but at view time we always recompute from the live
   * finance data so finance price changes flow in.
   */
  basePrice?: number;
  /** Commission % snapshot from the cadre at sale time. */
  commissionPercentage?: number;
  /** Commission amount snapshot — recomputed at view time. */
  commissionAmount?: number;
  commissionStatus?: "pending" | "approved" | "paid";
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/** Sentinel agentId for company-direct sales (no specific agent). */
export const DIRECT_SALES_AGENT_ID = "direct-sales";

export interface MarketingCadre {
  id: string;
  name: string;
  commissionPercentage: number;
  priority: number;
  icon: "crown" | "star" | "medal";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingAgent {
  id: string;
  fullName: string;
  phone: string;
  employeeId: string;
  joiningDate: string;
  profilePhoto?: string;
  email?: string;
  address?: string;
  cadreId: string;
  status: AgentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingExpense {
  id: string;
  agentId: string;
  category: string;
  amount: number;
  date: string;
  description?: string;
  projectId?: string;
  receiptUrl?: string;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionPayout {
  id: string;
  agentId: string;
  amount: number;
  paymentDate?: string;
  paymentReference?: string;
  notes?: string;
  status: PayoutStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingPerformanceSettings {
  salesVolumeWeight: number;
  revenueWeight: number;
  plotsSoldWeight: number;
  conversionRateWeight: number;
}

export interface Payment {
  id: string;
  plotId?: string;
  customerId?: string;
  bookingId?: string;
  saleId?: string;
  date: string;
  amount: number;
  paymentMode: PaymentMode;
  referenceNumber?: string;
  bank?: string;
  chequeNumber?: string;
  transactionId?: string;
  remarks?: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // demo only — real auth must happen server-side
  role: UserRole;
  avatar?: string;
  active: boolean;
  createdAt: string;
}

export interface CompanySettings {
  companyName: string;
  companyLogo?: string;
  gst?: string;
  address?: string;
  phone?: string;
  email?: string;
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    ifsc?: string;
    branch?: string;
  };
  upi?: string;
  paymentGateway?: string;
}

export interface ActivityLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string; // e.g. "CREATE_PROJECT"
  entity: string; // e.g. "project"
  entityId?: string;
  details?: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  type: "registration_today" | "booking_expiring" | "pending_payment" | "recently_sold" | "info";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

// ===== Route identifiers for state-based navigation =====
export type RouteKey =
  | "dashboard"
  | "projects"
  | "layouts"
  | "interactive-layout"
  | "customers"
  | "bookings"
  | "sales"
  | "payments"
  | "vacant-plots"
  | "booked-plots"
  | "reserved-plots"
  | "sold-plots"
  | "all-plots"
  | "reports"
  | "analytics"
  | "users"
  | "settings"
  | "discounts"
  | "marketing-team"
  | "generate-agreement"
  | "website-content"
  // Attendance module (Supabase 2 — isolated)
  | "att-overview"
  | "att-today"
  | "att-employees"
  | "att-history"
  | "att-reports"
  | "att-locations"
  | "att-settings"
  | "att-audit"
  | "att-salary"
  | "att-resources";



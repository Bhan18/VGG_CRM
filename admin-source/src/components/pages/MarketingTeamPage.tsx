
"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Crown, Medal, Star, Plus, Users, ReceiptText, WalletCards, Trophy,
  Settings2, Pencil, Archive, IndianRupee, TrendingUp, Trash2,
  MoreVertical, Eye, Filter, ChevronDown, Phone, Mail, MapPin, Calendar,
  UserCircle, Building2, PieChart, BarChart3, ListChecks, ArrowUpRight,
  Briefcase,
} from "lucide-react";
import { useCrm } from "@/lib/store";
import type {
  CommissionPayout, MarketingAgent, MarketingCadre, MarketingExpense,
  MarketingSale, Customer, Plot, Project, Booking, Sale,
} from "@/lib/types";
import { DIRECT_SALES_AGENT_ID } from "@/lib/types";
import type { Permissions } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { inr, inrCompact, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

const expenseCategories = [
  "Car/Fuel Bills", "Travel Expenses", "Accommodation", "Food",
  "Phone/Communication", "Marketing Expenses", "Printing",
  "Customer/Client Expenses", "Other",
];

type Tab = "team" | "agent-sales" | "expenses" | "payouts" | "performance" | "settings";

const iconFor = (icon: MarketingCadre["icon"], className = "w-4 h-4") =>
  icon === "crown" ? <Crown className={className} />
  : icon === "medal" ? <Medal className={className} />
  : <Star className={className} />;

const dateToday = () => new Date().toISOString().slice(0, 10);

/**
 * Sort cadres by priority (ascending — priority 1 = highest priority = shown first).
 * This matches the user's expectation that "Priority 1" is the top tier.
 */
const sortByPriority = (cadres: MarketingCadre[]) =>
  [...cadres].sort((a, b) => a.priority - b.priority);

/**
 * Recompute the commission amount for a sale based on the EFFECTIVE commission
 * base (plot's base price from finance, minus any extra discount the agent
 * gave from their commission) and the agent's cadre commission %.
 */
const computeCommission = (
  effectiveCommissionBase: number,
  commissionPercentage: number | undefined,
): number | undefined => {
  if (commissionPercentage === undefined) return undefined;
  return Math.round(effectiveCommissionBase * commissionPercentage) / 100;
};

/**
 * Compute the agent-sale BASE PRICE for a plot — i.e. the layout block's pure
 * base price × plot size, IGNORING facing premium, corner premium, and any
 * other extra costs. Per business rule:
 *   - "while creating layout block there exists a base price apart from facing
 *    and corner costs, take that base price for agent sale base price. ignore
 *    facing and extra costs."
 *
 * Source priority:
 *   1. plot.frozenPrice.basePricePerUnit × plot.frozenPrice.size   — for
 *      booked/reserved/sold plots, the snapshot captured at booking time.
 *      This already has facing + corner stripped (stored as separate fields).
 *   2. plot.basePricePerUnit × plot.size   — for available plots on layouts
 *      saved after the basePricePerUnit field was added.
 *   3. Reverse-engineer from sibling plots  — for available plots without
 *      basePricePerUnit. The caller passes allPlotsInProject so we can detect
 *      premiums and subtract them.
 *   4. plot.totalPrice  — last-resort fallback (will include premiums).
 *
 * For booked / reserved / sold plots, frozenPrice is captured ONCE at booking
 * time and is never recomputed when the layout is edited. Cancelling a booking
 * clears frozenPrice so the plot reverts to using the live layout price.
 */
const computePlotBasePrice = (
  plot: Plot | undefined | null,
  allPlotsInProject: Plot[] = [],
): number => {
  if (!plot) return 0;
  // 1) Frozen snapshot — authoritative for booked/reserved/sold plots.
  if (plot.frozenPrice) {
    const size = plot.frozenPrice.size ?? plot.size;
    return Math.round((plot.frozenPrice.basePricePerUnit * size) * 100) / 100;
  }
  // 2) New plot field (available plots on modern layouts).
  if (plot.basePricePerUnit !== undefined && plot.basePricePerUnit !== null) {
    return Math.round((plot.basePricePerUnit * plot.size) * 100) / 100;
  }
  // 3) Reverse-engineer from sibling plots in the same project.
  if (allPlotsInProject.length > 1 && plot.pricePerCent) {
    const nonCornerByFacing: Record<string, number[]> = {};
    const cornerByFacing: Record<string, number[]> = {};
    allPlotsInProject.forEach((p) => {
      if (p.cornerPlot) (cornerByFacing[p.facing] ||= []).push(p.pricePerCent);
      else (nonCornerByFacing[p.facing] ||= []).push(p.pricePerCent);
    });
    const nonCornerMins: Record<string, number> = {};
    Object.entries(nonCornerByFacing).forEach(([f, arr]) => {
      nonCornerMins[f] = Math.min(...arr);
    });
    const baseCandidates = Object.values(nonCornerMins);
    if (baseCandidates.length > 0) {
      const base = Math.min(...baseCandidates);
      const facingPrem = (nonCornerMins[plot.facing] ?? base) - base;
      let cornerPrem = 0;
      const cornerArr = cornerByFacing[plot.facing];
      if (cornerArr && cornerArr.length > 0 && nonCornerMins[plot.facing] !== undefined) {
        cornerPrem = Math.max(0, Math.min(...cornerArr) - nonCornerMins[plot.facing]);
      }
      const basePerUnit = Math.max(0, plot.pricePerCent - facingPrem - (plot.cornerPlot ? cornerPrem : 0));
      return Math.round((basePerUnit * plot.size) * 100) / 100;
    }
  }
  // 4) Last-resort fallback — may include premiums.
  if (plot.pricePerCent && plot.size) {
    return Math.round((plot.pricePerCent * plot.size) * 100) / 100;
  }
  return plot.totalPrice ?? 0;
};

/**
 * Shape of a marketing sale AFTER we've resolved all finance-derived fields.
 * Components should ALWAYS consume this view shape, never the raw MarketingSale.
 *
 * Money fields (basePrice, saleAmount, discount, balanceAmount, bookingAmount)
 * are looked up from the linked finance booking / sale / plot at view time so
 * that finance changes (price change, discount change) automatically flow into
 * the Marketing Team page without marketing needing to write anything.
 */
interface MarketingSaleView {
  /** Top-level id (mirrors sale.id) so DataTable's `T extends { id: string }` constraint is satisfied. */
  id: string;
  sale: MarketingSale;
  plot: Plot | undefined;
  project: Project | undefined;
  booking: Booking | undefined;
  financeSale: Sale | undefined;
  customer: Customer | undefined;
  agent: MarketingAgent | undefined;     // undefined when agentId === DIRECT_SALES_AGENT_ID
  cadre: MarketingCadre | undefined;
  isDirectSales: boolean;
  /** Plot's pure base price (no facing/corner premiums) — see computePlotBasePrice. */
  basePrice: number;
  /** Effective commission base = basePrice - extraDiscountFromCommission. */
  effectiveCommissionBase: number;
  /** Sale amount from finance (finance Sale.saleAmount ?? booking.advancePaid ?? 0). */
  saleAmount: number;
  /** Discount from finance (finance Sale.discount ?? booking.discount ?? 0). */
  discount: number;
  /** Booking amount from finance (booking.advancePaid ?? 0). */
  bookingAmount: number;
  /** Balance from finance (saleAmount - bookingAmount - payments, or fall back to sale.balanceAmount). */
  balanceAmount: number;
  commissionPercentage: number | undefined;
  commissionAmount: number | undefined;
}

/**
 * Build a view object for a marketing sale by resolving finance data at view
 * time. This is the single source of truth for how marketing reads finance —
 * finance is authoritative for money fields, marketing only contributes agent
 * attribution + the extra-discount-from-commission field.
 */
function buildMarketingSaleView(
  sale: MarketingSale,
  ctx: {
    plots: Plot[];
    projects: Project[];
    bookings: Booking[];
    sales: Sale[];
    customers: Customer[];
    agents: MarketingAgent[];
    cadres: MarketingCadre[];
  },
): MarketingSaleView {
  const plot = sale.plotId ? ctx.plots.find((p) => p.id === sale.plotId) : undefined;
  const project = plot ? ctx.projects.find((p) => p.id === plot.projectId) : undefined;
  const booking = sale.plotId
    ? ctx.bookings.find((b) => b.id === plot?.bookingId)
    : undefined;
  const financeSale = sale.plotId
    ? ctx.sales.find((s) => s.id === plot?.saleId)
    : undefined;
  const customer = sale.customerId
    ? ctx.customers.find((c) => c.id === sale.customerId)
    : plot?.customerId
      ? ctx.customers.find((c) => c.id === plot.customerId)
      : undefined;
  const isDirectSales = sale.agentId === DIRECT_SALES_AGENT_ID;
  const agent = !isDirectSales
    ? ctx.agents.find((a) => a.id === sale.agentId)
    : undefined;
  const cadre = agent ? ctx.cadres.find((c) => c.id === agent.cadreId) : undefined;

  // Money fields — always read from finance so changes flow in automatically.
  // Per business rule, the agent commission BASE PRICE = plot's pure base
  // (defaultPricePerUnit × size) WITHOUT facing/corner premiums. We do NOT
  // use booking.originalPlotPrice here because that snapshot was the FULL
  // plot price (with premiums). The plot's frozenPrice (captured at booking
  // time) or basePricePerUnit is used, so layout price edits later don't
  // change the agent commission base for booked/reserved/sold plots.
  const siblings = plot ? ctx.plots.filter((p) => p.projectId === plot.projectId) : [];
  const basePrice = computePlotBasePrice(plot, siblings) || sale.basePrice || 0;
  const extraDiscount = sale.extraDiscountFromCommission ?? 0;
  const effectiveCommissionBase = Math.max(0, basePrice - extraDiscount);
  const saleAmount = financeSale?.saleAmount ?? booking?.advancePaid ?? 0;
  const discount = financeSale?.discount ?? booking?.discount ?? 0;
  const bookingAmount = booking?.advancePaid ?? 0;
  const balanceAmount = Math.max(0, saleAmount - bookingAmount - (financeSale?.discount ?? 0));

  // Commission is recomputed at view time so finance price changes flow in.
  const commissionPercentage = sale.commissionPercentage ?? cadre?.commissionPercentage;
  const commissionAmount = isDirectSales
    ? 0
    : computeCommission(effectiveCommissionBase, commissionPercentage);

  return {
    id: sale.id,
    sale, plot, project, booking, financeSale, customer, agent, cadre,
    isDirectSales,
    basePrice, effectiveCommissionBase, saleAmount, discount,
    bookingAmount, balanceAmount,
    commissionPercentage, commissionAmount,
  };
}

export default function MarketingTeamPage({ permissions }: { permissions?: Permissions }) {
  const crm = useCrm();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("team");

  // Dialog open state
  const [agentDialog, setAgentDialog] = useState(false);
  const [cadreDialog, setCadreDialog] = useState(false);
  const [saleDialog, setSaleDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [payoutDialog, setPayoutDialog] = useState(false);
  // Agent detail side-sheet (full history)
  const [agentDetailId, setAgentDetailId] = useState<string | null>(null);

  // Editing state
  const [editingAgent, setEditingAgent] = useState<MarketingAgent | null>(null);
  const [editingCadre, setEditingCadre] = useState<MarketingCadre | null>(null);
  const [editingSale, setEditingSale] = useState<MarketingSale | null>(null);
  const [editingExpense, setEditingExpense] = useState<MarketingExpense | null>(null);
  const [editingPayout, setEditingPayout] = useState<CommissionPayout | null>(null);

  // Delete / archive confirmation state
  const [archiveCadreId, setArchiveCadreId] = useState<string | null>(null);
  const [deleteCadreId, setDeleteCadreId] = useState<string | null>(null);
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null);
  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deletePayoutId, setDeletePayoutId] = useState<string | null>(null);

  // Filter / sort / search state — independent per tab so users don't lose
  // their filters when switching tabs and coming back.
  const [teamSearch, setTeamSearch] = useState("");
  const [teamCadreFilter, setTeamCadreFilter] = useState<string>("all");
  const [teamStatusFilter, setTeamStatusFilter] = useState<string>("all");
  const [teamSort, setTeamSort] = useState<"name" | "recent" | "revenue" | "plots">("name");

  // Expenditures tab — filter state. Text search & column sort are handled by
  // DataTable's built-in controls. These dropdowns handle category / status /
  // agent filtering.
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all");
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<string>("all");
  const [expenseAgentFilter, setExpenseAgentFilter] = useState<string>("all");

  // Payouts tab — filter state.
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<string>("all");
  const [payoutAgentFilter, setPayoutAgentFilter] = useState<string>("all");

  // Form state
  const [agentForm, setAgentForm] = useState({
    fullName: "", phone: "", employeeId: "", joiningDate: dateToday(),
    profilePhoto: "", email: "", address: "", cadreId: "",
    status: "active" as MarketingAgent["status"], notes: "",
  });
  const [cadreForm, setCadreForm] = useState({
    name: "", commissionPercentage: 5, priority: 1, icon: "star" as MarketingCadre["icon"],
  });
  // Simplified Agent Sale form. Only fields the marketing team controls:
  //   - agent (with synthetic "Direct Sales" option for company-direct sales)
  //   - buyer (auto-filters the plot dropdown to that buyer's booked/reserved plots)
  //   - plot (only booked or reserved plots are eligible)
  //   - saleDate (when the agent closed the deal)
  //   - basePrice (auto-filled from the plot's project-level base price; can
  //     be reduced to give an extra discount from the agent's commission)
  // All other money fields (sale amount, discount, booking amount, balance,
  // payment method, registration office, executive name, registration number)
  // are READ from finance at view time and are NOT in this form.
  const [saleForm, setSaleForm] = useState({
    agentId: "" as string,            // "" | agentId | DIRECT_SALES_AGENT_ID
    plotId: "",
    customerId: "",
    saleDate: dateToday(),
    basePrice: 0,                     // auto-filled from plot, editable for commission discount
    extraDiscountFromCommission: 0,   // readonly display = basePrice(default) - basePrice(edited)
    remarks: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    agentId: "", category: expenseCategories[0], amount: 0, date: dateToday(),
    description: "", projectId: "", receiptUrl: "", status: "pending_review" as MarketingExpense["status"],
  });
  const [payoutForm, setPayoutForm] = useState({
    agentId: "", amount: 0, paymentDate: dateToday(),
    paymentReference: "", notes: "", status: "paid" as CommissionPayout["status"],
  });

  // Sorted cadres (priority ascending — priority 1 first)
  const sortedCadres = useMemo(() => sortByPriority(crm.marketingCadres), [crm.marketingCadres]);
  const activeCadres = sortedCadres.filter((c) => c.active);
  const activeAgents = crm.marketingAgents.filter((a) => a.status === "active");

  // Agent Sales are a REFERENCE-ONLY collection on top of finance data.
  // Marketing writes only agent attribution + extra-discount-from-commission;
  // all money fields are looked up from finance at view time via
  // buildMarketingSaleView.
  const financeCtx = useMemo(() => ({
    plots: crm.plots, projects: crm.projects, bookings: crm.bookings,
    sales: crm.sales, customers: crm.customers,
    agents: crm.marketingAgents, cadres: crm.marketingCadres,
  }), [crm.plots, crm.projects, crm.bookings, crm.sales, crm.customers,
       crm.marketingAgents, crm.marketingCadres]);

  const allMarketingSaleViews = useMemo(
    () => crm.marketingSales.map((s) => buildMarketingSaleView(s, financeCtx)),
    [crm.marketingSales, financeCtx],
  );

  const canEdit = permissions?.canCreateSales !== false;
  const canDelete = permissions?.canDeleteData;

  // Eligible plots for the Agent Sale dropdown — only booked or reserved plots
  // (sold plots already have a finance sale; available plots have no deal yet).
  const eligiblePlots = useMemo(
    () => crm.plots.filter((p) => p.status === "booked" || p.status === "reserved"),
    [crm.plots],
  );

  // When the user picks a buyer, further narrow the plot list to only that
  // buyer's booked/reserved plots.
  const buyerFilteredPlots = useMemo(() => {
    if (!saleForm.customerId) return eligiblePlots;
    return eligiblePlots.filter((p) => p.customerId === saleForm.customerId);
  }, [eligiblePlots, saleForm.customerId]);

  // Per-agent commission / payout stats — uses the resolved sale views so all
  // money fields reflect the latest finance data (price changes, discount
  // changes, etc. flow in automatically).
  const agentStats = useMemo(() => crm.marketingAgents.map((agent) => {
    const sales = allMarketingSaleViews.filter((v) => v.agent?.id === agent.id);
    const gross = sales.reduce((sum, v) => sum + (v.commissionAmount ?? 0), 0);
    const expenses = crm.marketingExpenses
      .filter((expense) => expense.agentId === agent.id && ["approved", "deducted_from_commission"].includes(expense.status))
      .reduce((sum, expense) => sum + expense.amount, 0);
    const paid = crm.commissionPayouts
      .filter((payout) => payout.agentId === agent.id && ["paid", "partially_paid"].includes(payout.status))
      .reduce((sum, payout) => sum + payout.amount, 0);
    const value = sales.reduce((sum, v) => sum + v.saleAmount, 0);
    return {
      agent, sales, gross, expenses, paid, value,
      net: Math.max(0, gross - expenses),
      remaining: Math.max(0, gross - expenses - paid),
    };
  }), [crm.marketingAgents, crm.marketingExpenses, crm.commissionPayouts, allMarketingSaleViews]);

  // Filtered + sorted team list (search + cadre filter + status filter + sort)
  const filteredAgentStats = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    let list = agentStats.filter(({ agent }) => {
      const cadre = crm.marketingCadres.find((c) => c.id === agent.cadreId);
      const matchesSearch = !q
        || agent.fullName.toLowerCase().includes(q)
        || agent.phone.toLowerCase().includes(q)
        || agent.employeeId.toLowerCase().includes(q)
        || (agent.email ?? "").toLowerCase().includes(q)
        || (cadre?.name ?? "").toLowerCase().includes(q);
      const matchesCadre = teamCadreFilter === "all" || agent.cadreId === teamCadreFilter;
      const matchesStatus = teamStatusFilter === "all" || agent.status === teamStatusFilter;
      return matchesSearch && matchesCadre && matchesStatus;
    });
    list = [...list].sort((a, b) => {
      switch (teamSort) {
        case "name": return a.agent.fullName.localeCompare(b.agent.fullName);
        case "recent": return new Date(b.agent.joiningDate).getTime() - new Date(a.agent.joiningDate).getTime();
        case "revenue": return b.value - a.value;
        case "plots": return b.sales.length - a.sales.length;
        default: return 0;
      }
    });
    return list;
  }, [agentStats, teamSearch, teamCadreFilter, teamStatusFilter, teamSort, crm.marketingCadres]);

  // Aggregate sold-plots summary across all agents (used by the Team tab header strip).
  // Includes Direct Sales in the totals so the company-direct channel is visible.
  const teamSummary = useMemo(() => {
    const totalAgents = crm.marketingAgents.length;
    const totalPlotsSold = allMarketingSaleViews.length;
    const totalRevenue = allMarketingSaleViews.reduce((sum, v) => sum + v.saleAmount, 0);
    const totalCommission = allMarketingSaleViews.reduce((sum, v) => sum + (v.commissionAmount ?? 0), 0);
    return { totalAgents, totalPlotsSold, totalRevenue, totalCommission };
  }, [crm.marketingAgents, allMarketingSaleViews]);

  // Filtered expenses (dropdown filters only — text search is handled by DataTable)
  const filteredExpenses = useMemo(() => {
    return crm.marketingExpenses.filter((e) => {
      const matchesCategory = expenseCategoryFilter === "all" || e.category === expenseCategoryFilter;
      const matchesStatus = expenseStatusFilter === "all" || e.status === expenseStatusFilter;
      const matchesAgent = expenseAgentFilter === "all" || e.agentId === expenseAgentFilter;
      return matchesCategory && matchesStatus && matchesAgent;
    });
  }, [crm.marketingExpenses, expenseCategoryFilter, expenseStatusFilter, expenseAgentFilter]);

  // Filtered payouts (dropdown filters only)
  const filteredPayouts = useMemo(() => {
    return crm.commissionPayouts.filter((p) => {
      const matchesStatus = payoutStatusFilter === "all" || p.status === payoutStatusFilter;
      const matchesAgent = payoutAgentFilter === "all" || p.agentId === payoutAgentFilter;
      return matchesStatus && matchesAgent;
    });
  }, [crm.commissionPayouts, payoutStatusFilter, payoutAgentFilter]);

  // Agent detail (for the side-sheet). Computed when agentDetailId is set.
  const agentDetail = useMemo(() => {
    if (!agentDetailId) return null;
    const agent = crm.marketingAgents.find((a) => a.id === agentDetailId);
    if (!agent) return null;
    const cadre = crm.marketingCadres.find((c) => c.id === agent.cadreId);
    // Use resolved sale views so all money fields reflect the latest finance data.
    const sales = allMarketingSaleViews.filter((v) => v.agent?.id === agent.id)
      .sort((a, b) => new Date(b.sale.saleDate).getTime() - new Date(a.sale.saleDate).getTime());
    const expenses = crm.marketingExpenses.filter((e) => e.agentId === agent.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const payouts = crm.commissionPayouts.filter((p) => p.agentId === agent.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const customers = sales
      .map((v) => v.customer)
      .filter((c): c is Customer => !!c);
    const plots = sales
      .map((v) => v.plot)
      .filter((p): p is Plot => !!p);
    const totalRevenue = sales.reduce((sum, v) => sum + v.saleAmount, 0);
    const totalCommission = sales.reduce((sum, v) => sum + (v.commissionAmount ?? 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaid = payouts.filter((p) => ["paid", "partially_paid"].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);
    const uniqueCustomers = Array.from(new Set(customers.map((c) => c.id)))
      .map((id) => customers.find((c) => c.id === id)!)
      .filter(Boolean);
    return {
      agent, cadre, sales, expenses, payouts, customers: uniqueCustomers, plots,
      totalRevenue, totalCommission, totalExpenses, totalPaid,
      netRemaining: Math.max(0, totalCommission - totalExpenses - totalPaid),
    };
  }, [agentDetailId, crm.marketingAgents, crm.marketingCadres, crm.marketingExpenses,
      crm.commissionPayouts, crm.customers, crm.plots, allMarketingSaleViews]);

  // ---------- Agent handlers ----------
  const openAgent = (agent?: MarketingAgent) => {
    setEditingAgent(agent ?? null);
    setAgentForm(agent
      ? {
          fullName: agent.fullName, phone: agent.phone, employeeId: agent.employeeId,
          joiningDate: agent.joiningDate.slice(0, 10), profilePhoto: agent.profilePhoto ?? "",
          email: agent.email ?? "", address: agent.address ?? "", cadreId: agent.cadreId,
          status: agent.status, notes: agent.notes ?? "",
        }
      : {
          fullName: "", phone: "", employeeId: "", joiningDate: dateToday(),
          profilePhoto: "", email: "", address: "", cadreId: activeCadres[0]?.id ?? "",
          status: "active", notes: "",
        },
    );
    setAgentDialog(true);
  };
  const saveAgent = () => {
    if (!agentForm.fullName || !agentForm.phone || !agentForm.employeeId || !agentForm.cadreId) {
      return toast({ title: "Complete the required agent fields", variant: "destructive" });
    }
    try {
      if (editingAgent) crm.updateMarketingAgent(editingAgent.id, agentForm);
      else crm.addMarketingAgent(agentForm);
      toast({ title: editingAgent ? "Agent updated" : "Team member added" });
      setAgentDialog(false);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not save agent", variant: "destructive" });
    }
  };
  const confirmDeleteAgent = () => {
    if (!deleteAgentId) return;
    try {
      crm.deleteMarketingAgent?.(deleteAgentId);
      toast({ title: "Agent deleted" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not delete agent", variant: "destructive" });
    }
    setDeleteAgentId(null);
  };

  // ---------- Cadre handlers ----------
  const openCadre = (cadre?: MarketingCadre) => {
    setEditingCadre(cadre ?? null);
    setCadreForm(cadre
      ? { name: cadre.name, commissionPercentage: cadre.commissionPercentage, priority: cadre.priority, icon: cadre.icon }
      : { name: "", commissionPercentage: 5, priority: 1, icon: "star" },
    );
    setCadreDialog(true);
  };
  const saveCadre = () => {
    if (!cadreForm.name || cadreForm.commissionPercentage < 0 || cadreForm.commissionPercentage > 100) {
      return toast({ title: "Enter a valid cadre name and commission rate (0–100, decimals allowed)", variant: "destructive" });
    }
    if (editingCadre) {
      crm.updateMarketingCadre(editingCadre.id, { ...cadreForm, active: editingCadre.active });
    } else {
      crm.addMarketingCadre({ ...cadreForm, active: true });
    }
    toast({ title: editingCadre ? "Cadre updated" : "Cadre created", description: "Historical sale commissions remain unchanged." });
    setCadreDialog(false);
  };
  const confirmArchiveCadre = () => {
    try {
      if (archiveCadreId) crm.archiveMarketingCadre(archiveCadreId);
      toast({ title: "Cadre archived" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Unable to archive cadre", variant: "destructive" });
    }
    setArchiveCadreId(null);
  };
  const confirmDeleteCadre = () => {
    if (!deleteCadreId) return;
    try {
      crm.deleteMarketingCadre?.(deleteCadreId);
      toast({ title: "Cadre deleted" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Unable to delete cadre", variant: "destructive" });
    }
    setDeleteCadreId(null);
  };

  // ---------- Agent Sale handlers ----------
  // Agent Sales are a REFERENCE-ONLY layer on top of finance. The form below
  // captures only agent attribution + the extra-discount-from-commission
  // field. All other money fields are looked up from finance at view time
  // via buildMarketingSaleView, so finance changes flow in automatically and
  // marketing never writes back to finance.
  const resetSaleForm = () => ({
    agentId: activeAgents[0]?.id ?? "",
    plotId: "",
    customerId: "",
    saleDate: dateToday(),
    basePrice: 0,
    extraDiscountFromCommission: 0,
    remarks: "",
  });
  const openSale = (sale?: MarketingSale) => {
    setEditingSale(sale ?? null);
    if (sale) {
      // Resolve finance-derived base price so the form shows the current
      // commission base (plot base price - any stored extra discount).
      const view = buildMarketingSaleView(sale, financeCtx);
      setSaleForm({
        agentId: sale.agentId,
        plotId: sale.plotId ?? "",
        customerId: sale.customerId ?? view.plot?.customerId ?? "",
        saleDate: sale.saleDate.slice(0, 10),
        basePrice: view.basePrice - (sale.extraDiscountFromCommission ?? 0),
        extraDiscountFromCommission: sale.extraDiscountFromCommission ?? 0,
        remarks: sale.remarks ?? "",
      });
    } else {
      setSaleForm(resetSaleForm());
    }
    setSaleDialog(true);
  };
  // Auto-fill base price + customer from the selected plot. The user can
  // still edit the base price field — lowering it represents giving an extra
  // discount from the agent's commission.
  const onPlotChange = (plotId: string) => {
    const plot = crm.plots.find((item) => item.id === plotId);
    const booking = crm.bookings.find((item) => item.id === plot?.bookingId);
    // Use the plot's PURE base price (no facing/corner premiums) per business rule.
    // For booked/reserved/sold plots, reads frozenPrice.basePricePerUnit × size.
    const siblings = plot ? crm.plots.filter((p) => p.projectId === plot.projectId) : [];
    const defaultBasePrice = computePlotBasePrice(plot, siblings);
    setSaleForm((form) => ({
      ...form,
      plotId,
      customerId: plot?.customerId ?? booking?.customerId ?? form.customerId,
      basePrice: defaultBasePrice,
      // Reset any prior extra discount when a new plot is picked.
      extraDiscountFromCommission: 0,
    }));
  };
  // When the user edits the base price field, treat the reduction as an
  // extra discount given from the agent's commission. The finance sale
  // amount is NOT affected — only the commission base is.
  const onBasePriceEdit = (editedBasePrice: number) => {
    const plot = saleForm.plotId ? crm.plots.find((p) => p.id === saleForm.plotId) : undefined;
    const siblings = plot ? crm.plots.filter((p) => p.projectId === plot.projectId) : [];
    const defaultBasePrice = computePlotBasePrice(plot, siblings);
    const extraDiscount = Math.max(0, defaultBasePrice - editedBasePrice);
    setSaleForm((form) => ({
      ...form,
      basePrice: editedBasePrice,
      extraDiscountFromCommission: extraDiscount,
    }));
  };
  const saveSale = () => {
    if (!saleForm.agentId) {
      return toast({ title: "Select an agent or Direct Sales", variant: "destructive" });
    }
    if (!saleForm.plotId) {
      return toast({ title: "Select a plot — only booked or reserved plots are eligible", variant: "destructive" });
    }
    const plot = crm.plots.find((item) => item.id === saleForm.plotId);
    if (!plot) {
      return toast({ title: "Plot not found", variant: "destructive" });
    }
    if (plot.status !== "booked" && plot.status !== "reserved") {
      return toast({ title: `Plot is ${plot.status} — only booked or reserved plots can be linked`, variant: "destructive" });
    }
    const booking = crm.bookings.find((item) => item.id === plot.bookingId);
    // Use the plot's PURE base price (no facing/corner premiums) per business rule.
    // For booked/reserved plots, this reads frozenPrice.basePricePerUnit × size.
    const siblings = crm.plots.filter((p) => p.projectId === plot.projectId);
    const defaultBasePrice = computePlotBasePrice(plot, siblings);
    const extraDiscount = Math.max(0, defaultBasePrice - saleForm.basePrice);

    // Direct Sales has no agent/cadre, so commission is 0 and percentage undefined.
    const isDirectSales = saleForm.agentId === DIRECT_SALES_AGENT_ID;
    const agent = !isDirectSales ? crm.marketingAgents.find((a) => a.id === saleForm.agentId) : undefined;
    const cadre = agent ? crm.marketingCadres.find((c) => c.id === agent.cadreId) : undefined;
    const commissionPercentage = isDirectSales ? undefined : (cadre?.commissionPercentage);
    const effectiveCommissionBase = Math.max(0, defaultBasePrice - extraDiscount);
    const commissionAmount = isDirectSales ? 0 : computeCommission(effectiveCommissionBase, commissionPercentage);

    const payload = {
      agentId: saleForm.agentId,
      plotId: saleForm.plotId,
      customerId: saleForm.customerId || plot.customerId || booking?.customerId || undefined,
      saleDate: new Date(saleForm.saleDate).toISOString(),
      extraDiscountFromCommission: extraDiscount,
      basePrice: defaultBasePrice,
      remarks: saleForm.remarks,
      commissionPercentage,
      commissionAmount,
      commissionStatus: (editingSale?.commissionStatus ?? "pending") as MarketingSale["commissionStatus"],
    };
    try {
      if (editingSale) {
        crm.updateMarketingSale(editingSale.id, payload);
        toast({
          title: "Agent sale updated",
          description: isDirectSales
            ? "Direct Sales record updated. No commission attributed."
            : `Commission recalculated: ${commissionPercentage}% × ${inr(effectiveCommissionBase)} = ${inr(commissionAmount ?? 0)}.`,
        });
      } else {
        crm.addMarketingSale(payload);
        toast({
          title: isDirectSales ? "Direct sale recorded" : "Agent sale recorded",
          description: "Reference-only — finance sale and plot status are not affected.",
        });
      }
      setSaleDialog(false);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not save sale", variant: "destructive" });
    }
  };
  const confirmDeleteSale = () => {
    if (!deleteSaleId) return;
    crm.deleteMarketingSale(deleteSaleId);
    toast({ title: "Agent sale deleted", description: "Finance sale and plot status are not affected.", variant: "destructive" });
    setDeleteSaleId(null);
  };

  // ---------- Expense handlers ----------
  const resetExpenseForm = () => ({
    agentId: activeAgents[0]?.id ?? "", category: expenseCategories[0], amount: 0, date: dateToday(),
    description: "", projectId: "", receiptUrl: "", status: "pending_review" as MarketingExpense["status"],
  });
  const openExpense = (expense?: MarketingExpense) => {
    setEditingExpense(expense ?? null);
    if (expense) {
      setExpenseForm({
        agentId: expense.agentId,
        category: expense.category,
        amount: expense.amount,
        date: expense.date.slice(0, 10),
        description: expense.description ?? "",
        projectId: expense.projectId ?? "",
        receiptUrl: expense.receiptUrl ?? "",
        status: expense.status,
      });
    } else {
      setExpenseForm(resetExpenseForm());
    }
    setExpenseDialog(true);
  };
  const saveExpense = () => {
    if (!expenseForm.agentId || expenseForm.amount <= 0) {
      return toast({ title: "Select an agent and valid expense amount", variant: "destructive" });
    }
    const payload = {
      ...expenseForm,
      projectId: expenseForm.projectId || undefined,
      receiptUrl: expenseForm.receiptUrl || undefined,
    };
    if (editingExpense) {
      crm.updateMarketingExpense(editingExpense.id, payload);
      toast({ title: "Expense updated" });
    } else {
      crm.addMarketingExpense({ ...payload, status: "pending_review" });
      toast({ title: "Expense submitted for review" });
    }
    setExpenseDialog(false);
  };
  const confirmDeleteExpense = () => {
    if (!deleteExpenseId) return;
    crm.deleteMarketingExpense?.(deleteExpenseId);
    toast({ title: "Expense deleted", variant: "destructive" });
    setDeleteExpenseId(null);
  };

  // ---------- Payout handlers ----------
  const resetPayoutForm = () => ({
    agentId: agentStats.find((s) => s.remaining > 0)?.agent.id ?? "",
    amount: 0, paymentDate: dateToday(),
    paymentReference: "", notes: "", status: "paid" as CommissionPayout["status"],
  });
  const openPayout = (payout?: CommissionPayout) => {
    setEditingPayout(payout ?? null);
    if (payout) {
      setPayoutForm({
        agentId: payout.agentId,
        amount: payout.amount,
        paymentDate: payout.paymentDate?.slice(0, 10) ?? dateToday(),
        paymentReference: payout.paymentReference ?? "",
        notes: payout.notes ?? "",
        status: payout.status,
      });
    } else {
      setPayoutForm(resetPayoutForm());
    }
    setPayoutDialog(true);
  };
  const savePayout = () => {
    if (!payoutForm.agentId || payoutForm.amount <= 0) {
      return toast({ title: "Select an agent and amount", variant: "destructive" });
    }
    const row = agentStats.find((item) => item.agent.id === payoutForm.agentId);
    if (!editingPayout && payoutForm.amount > (row?.remaining ?? 0)) {
      return toast({ title: "Amount exceeds the remaining payable commission", variant: "destructive" });
    }
    if (editingPayout) {
      crm.updateCommissionPayout(editingPayout.id, payoutForm);
      toast({ title: "Payout updated" });
    } else {
      crm.addCommissionPayout(payoutForm);
      // Mark this agent's approved Agent Sales as paid (independent of finance sales)
      crm.marketingSales
        .filter((sale) => sale.agentId === payoutForm.agentId && sale.commissionStatus === "approved")
        .forEach((sale) => crm.updateMarketingSale(sale.id, { commissionStatus: "paid" }));
      toast({ title: "Payout recorded" });
    }
    setPayoutDialog(false);
  };
  const confirmDeletePayout = () => {
    if (!deletePayoutId) return;
    crm.deleteCommissionPayout?.(deletePayoutId);
    toast({ title: "Payout deleted", variant: "destructive" });
    setDeletePayoutId(null);
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
    { id: "team", label: "Team", icon: Users },
    { id: "agent-sales", label: "Agent Sales", icon: IndianRupee },
    { id: "expenses", label: "Expenditures", icon: ReceiptText },
    { id: "payouts", label: "Payouts", icon: WalletCards },
    { id: "performance", label: "Performance", icon: Trophy },
    { id: "settings", label: "Settings", icon: Settings2 },
  ];

  // ---------- Agent Sales table columns ----------
  // Operates on MarketingSaleView (resolved at view time from finance data) so
  // all money fields reflect the latest finance state.
  const saleColumns: DataTableColumn<MarketingSaleView>[] = [
    {
      key: "ref",
      header: "Reference",
      sortable: true,
      sortValue: (v) => v.sale.referenceCode ?? "",
      render: (v) => (
        <div>
          <div className="font-mono text-[11px] font-semibold text-primary">{v.sale.referenceCode ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground">{v.financeSale?.registrationNumber ?? v.booking?.referenceCode ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "plot",
      header: "Plot",
      sortable: true,
      sortValue: (v) => v.plot?.plotNumber ?? "",
      render: (v) => (
        <div>
          <div className="font-medium text-sm">{v.plot ? `${v.plot.block}-${v.plot.plotNumber}` : "—"}</div>
          <div className="text-[11px] text-muted-foreground">{v.project?.name ?? ""}</div>
        </div>
      ),
    },
    {
      key: "buyer",
      header: "Buyer",
      sortable: true,
      sortValue: (v) => v.customer?.name ?? "",
      render: (v) => (
        <div>
          <div className="font-medium text-sm">{v.customer?.name ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">{v.customer?.phone ?? ""}</div>
        </div>
      ),
    },
    {
      key: "agent",
      header: "Agent",
      sortable: true,
      sortValue: (v) => v.isDirectSales ? "Direct Sales" : (v.agent?.fullName ?? ""),
      render: (v) => {
        if (v.isDirectSales) {
          return (
            <div>
              <div className="font-medium text-sm flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-primary" />
                Direct Sales
              </div>
              <div className="text-[11px] text-muted-foreground">Company-direct (no commission)</div>
            </div>
          );
        }
        return v.agent ? (
          <div>
            <div className="font-medium text-sm">{v.agent.fullName}</div>
            {v.cadre && <div className="text-[11px] text-amber-700 flex items-center gap-1">{iconFor(v.cadre.icon, "w-3 h-3")} {v.cadre.name}</div>}
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      key: "saleAmount",
      header: "Sale Amount",
      sortable: true,
      sortValue: (v) => v.saleAmount,
      render: (v) => (
        <div className="text-right">
          <div className="font-semibold text-sm">{inr(v.saleAmount)}</div>
          {v.discount > 0 && <div className="text-[11px] text-muted-foreground">disc: {inr(v.discount)}</div>}
        </div>
      ),
    },
    {
      key: "basePrice",
      header: "Base Price",
      sortable: true,
      sortValue: (v) => v.basePrice,
      render: (v) => (
        <div className="text-right">
          <div className="text-sm">{inr(v.basePrice)}</div>
          {v.sale.extraDiscountFromCommission ? (
            <div className="text-[10px] text-rose-600">− {inr(v.sale.extraDiscountFromCommission)} agent disc.</div>
          ) : (
            <div className="text-[10px] text-muted-foreground">commission base</div>
          )}
        </div>
      ),
    },
    {
      key: "commission",
      header: "Commission",
      sortable: true,
      sortValue: (v) => v.commissionAmount ?? 0,
      render: (v) => (
        <div className="text-sm">
          {v.isDirectSales ? (
            <span className="text-muted-foreground">— direct —</span>
          ) : v.commissionPercentage !== undefined ? (
            <>
              <span className="text-muted-foreground">{v.commissionPercentage}%</span>
              {" · "}
              <strong>{inr(v.commissionAmount ?? 0)}</strong>
              {v.sale.extraDiscountFromCommission ? (
                <div className="text-[10px] text-muted-foreground">on {inr(v.effectiveCommissionBase)} (after agent disc.)</div>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (v) => v.sale.commissionStatus ?? "pending",
      render: (v) => <Badge className="capitalize">{v.sale.commissionStatus ?? "pending"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (v) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Row actions">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!v.isDirectSales && v.agent && (
              <DropdownMenuItem onClick={() => setAgentDetailId(v.agent!.id)}>
                <Eye className="w-3.5 h-3.5 mr-2" /> View agent
              </DropdownMenuItem>
            )}
            {canEdit && (
              <DropdownMenuItem onClick={() => openSale(v.sale)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-rose-600 focus:text-rose-700 focus:bg-rose-50" onClick={() => setDeleteSaleId(v.sale.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ---------- Expense table columns (3-dot menu for edit/delete) ----------
  const expenseColumns: DataTableColumn<MarketingExpense>[] = [
    {
      key: "agent",
      header: "Agent",
      sortable: true,
      sortValue: (e) => crm.marketingAgents.find((a) => a.id === e.agentId)?.fullName ?? "",
      render: (e) => {
        const agent = crm.marketingAgents.find((a) => a.id === e.agentId);
        return (
          <div>
            <div className="font-medium text-sm">{agent?.fullName ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">{agent?.employeeId ?? ""}</div>
          </div>
        );
      },
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      sortValue: (e) => e.category,
      render: (e) => (
        <div>
          <div className="font-medium text-sm">{e.category}</div>
          {e.description && <div className="text-[11px] text-muted-foreground line-clamp-1">{e.description}</div>}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (e) => e.amount,
      render: (e) => <span className="font-medium text-sm">{inr(e.amount)}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (e) => e.date,
      render: (e) => <span className="text-sm">{formatDate(e.date)}</span>,
    },
    {
      key: "project",
      header: "Project",
      sortable: true,
      sortValue: (e) => crm.projects.find((p) => p.id === e.projectId)?.name ?? "",
      render: (e) => {
        const project = e.projectId ? crm.projects.find((p) => p.id === e.projectId) : undefined;
        return <span className="text-sm">{project?.name ?? "—"}</span>;
      },
    },
    {
      key: "status",
      header: "Approval",
      sortable: true,
      sortValue: (e) => e.status,
      render: (e) => (
        <Select
          value={e.status}
          onValueChange={(status) => crm.updateMarketingExpense(e.id, { status: status as MarketingExpense["status"] })}
        >
          <SelectTrigger className="h-8 w-[180px] capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["pending_review", "approved", "rejected", "reimbursed", "deducted_from_commission"].map((status) => (
              <SelectItem key={status} value={status} className="capitalize">{status.replaceAll("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (e) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Row actions">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setAgentDetailId(e.agentId)}>
              <Eye className="w-3.5 h-3.5 mr-2" /> View agent
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => openExpense(e)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-rose-600 focus:text-rose-700 focus:bg-rose-50" onClick={() => setDeleteExpenseId(e.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ---------- Payout history columns (3-dot menu for edit/delete) ----------
  const payoutColumns: DataTableColumn<CommissionPayout>[] = [
    {
      key: "agent",
      header: "Agent",
      sortable: true,
      sortValue: (p) => crm.marketingAgents.find((a) => a.id === p.agentId)?.fullName ?? "",
      render: (p) => {
        const agent = crm.marketingAgents.find((a) => a.id === p.agentId);
        return (
          <div>
            <div className="font-medium text-sm">{agent?.fullName ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">{agent?.employeeId ?? ""}</div>
          </div>
        );
      },
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (p) => p.paymentDate ?? p.createdAt,
      render: (p) => <span className="text-sm">{p.paymentDate ? formatDate(p.paymentDate) : "—"}</span>,
    },
    {
      key: "reference",
      header: "Reference",
      sortable: true,
      sortValue: (p) => p.paymentReference ?? "",
      render: (p) => (
        <div>
          <div className="font-mono text-[11px]">{p.paymentReference ?? "—"}</div>
          {p.notes && <div className="text-[11px] text-muted-foreground line-clamp-1">{p.notes}</div>}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (p) => p.amount,
      render: (p) => <span className="font-medium text-sm">{inr(p.amount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (p) => p.status,
      render: (p) => <Badge className="capitalize">{p.status.replaceAll("_", " ")}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Row actions">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setAgentDetailId(p.agentId)}>
              <Eye className="w-3.5 h-3.5 mr-2" /> View agent
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => openPayout(p)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-rose-600 focus:text-rose-700 focus:bg-rose-50" onClick={() => setDeletePayoutId(p.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Marketing Team"
        description="Independent Agent Sales, agent commissions, expenses, payouts and performance — fully delinked from finance."
      />

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button key={id} size="sm" variant={tab === id ? "default" : "ghost"} className="shrink-0" onClick={() => setTab(id)}>
            <Icon className="mr-1.5 h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      {/* ===== TEAM TAB ===== */}
      {tab === "team" && (
        <>
          {/* Summary strip — aggregate sold plots of all agents */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Active agents</div>
                  <div className="text-2xl font-bold mt-1">{teamSummary.totalAgents}</div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Users className="w-4 h-4" /></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Plots sold (agent sales)</div>
                  <div className="text-2xl font-bold mt-1">{teamSummary.totalPlotsSold}</div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><ListChecks className="w-4 h-4" /></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Total revenue</div>
                  <div className="text-2xl font-bold mt-1">{inrCompact(teamSummary.totalRevenue)}</div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-700"><IndianRupee className="w-4 h-4" /></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Total commission</div>
                  <div className="text-2xl font-bold mt-1">{inrCompact(teamSummary.totalCommission)}</div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><TrendingUp className="w-4 h-4" /></div>
              </div>
            </Card>
          </div>

          {/* Filter / sort / search toolbar */}
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search by name, phone, employee ID, email, cadre..."
                  className="h-9 pl-8 text-sm"
                />
                <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              <Select value={teamCadreFilter} onValueChange={setTeamCadreFilter}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="All cadres" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cadres</SelectItem>
                  {sortedCadres.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={teamStatusFilter} onValueChange={setTeamStatusFilter}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["active", "inactive", "suspended", "archived"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={teamSort} onValueChange={(v) => setTeamSort(v as typeof teamSort)}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: Name (A–Z)</SelectItem>
                  <SelectItem value="recent">Sort: Recently joined</SelectItem>
                  <SelectItem value="revenue">Sort: Revenue (high→low)</SelectItem>
                  <SelectItem value="plots">Sort: Plots sold (high→low)</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{filteredAgentStats.length} of {crm.marketingAgents.length}</span>
                {canEdit && <Button onClick={() => openAgent()} disabled={!activeCadres.length}><Plus className="mr-1.5 h-4 w-4" />Add Team Member</Button>}
              </div>
            </div>
          </Card>

          {!activeCadres.length && (
            <Card className="p-5 text-sm text-muted-foreground">Create a cadre in Marketing Settings before adding a team member.</Card>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredAgentStats.map(({ agent, sales, value, remaining }) => {
              const cadre = crm.marketingCadres.find((item) => item.id === agent.cadreId);
              return (
                <Card key={agent.id} className="p-4 group relative">
                  <div className="flex items-start justify-between">
                    <button
                      type="button"
                      onClick={() => setAgentDetailId(agent.id)}
                      className="flex gap-3 text-left hover:opacity-90"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                        {agent.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-1">
                          {agent.fullName}
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                        </div>
                        <div className="text-xs text-muted-foreground">{agent.employeeId} · {agent.phone}</div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="capitalize">{agent.status}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Agent actions">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAgentDetailId(agent.id)}>
                            <Eye className="w-3.5 h-3.5 mr-2" /> View full history
                          </DropdownMenuItem>
                          {canEdit && (
                            <DropdownMenuItem onClick={() => openAgent(agent)}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600 focus:text-rose-700 focus:bg-rose-50" onClick={() => setDeleteAgentId(agent.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    {cadre && <span className="inline-flex items-center gap-1 text-amber-700">{iconFor(cadre.icon)} {cadre.name}</span>}
                    <span className="text-muted-foreground">{cadre?.commissionPercentage ?? 0}%</span>
                  </div>
                  {/* Sold plots summary for this agent */}
                  <div className="mt-3 grid grid-cols-3 border-t pt-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Plots sold</div>
                      <strong>{sales.length}</strong>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Sales value</div>
                      <strong>{inrCompact(value)}</strong>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Net payable</div>
                      <strong>{inrCompact(remaining)}</strong>
                    </div>
                  </div>
                </Card>
              );
            })}
            {filteredAgentStats.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                No team members match the current filters.
              </Card>
            )}
          </div>
        </>
      )}

      {/* ===== AGENT SALES TAB ===== */}
      {tab === "agent-sales" && (
        <>
          <div className="flex justify-end">
            {canEdit && (
              <Button onClick={() => openSale()}>
                <Plus className="mr-1.5 h-4 w-4" />Record Agent Sale
              </Button>
            )}
          </div>
          <DataTable
            title="Agent Sales"
            description="Reference-only — money fields (sale amount, discount) are read from finance. Marketing writes only agent attribution + any extra discount given from the agent's commission."
            columns={saleColumns}
            rows={allMarketingSaleViews}
            searchPlaceholder="Search by ref #, plot, buyer, agent..."
            searchKeys={[
              (v) => v.sale.referenceCode ?? "",
              (v) => v.financeSale?.registrationNumber ?? "",
              (v) => v.plot?.plotNumber ?? "",
              (v) => v.customer?.name ?? "",
              (v) => v.isDirectSales ? "Direct Sales" : (v.agent?.fullName ?? ""),
            ]}
            exportFilename="vgg-agent-sales"
            pageSize={10}
            onRowClick={(v) => canEdit && openSale(v.sale)}
            emptyMessage="No agent sales recorded yet."
            permissions={permissions ? { canExport: permissions.canExport } : undefined}
          />
        </>
      )}

      {/* ===== EXPENSES TAB ===== */}
      {tab === "expenses" && (
        <>
          <div className="flex justify-end">
            {canEdit && <Button onClick={() => openExpense()}><Plus className="mr-1.5 h-4 w-4" />Add Expense</Button>}
          </div>
          <DataTable
            title="Expenditures"
            description="Agent-submitted expenses. Approve, reject or mark as deducted from commission. Click column headers to sort."
            columns={expenseColumns}
            rows={filteredExpenses}
            searchPlaceholder="Search by agent, category, description..."
            searchKeys={[
              (e) => crm.marketingAgents.find((a) => a.id === e.agentId)?.fullName ?? "",
              (e) => e.category,
              (e) => e.description ?? "",
            ]}
            toolbar={
              <>
                <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                  <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={expenseStatusFilter} onValueChange={setExpenseStatusFilter}>
                  <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {["pending_review", "approved", "rejected", "reimbursed", "deducted_from_commission"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replaceAll("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={expenseAgentFilter} onValueChange={setExpenseAgentFilter}>
                  <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="All agents" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {crm.marketingAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{filteredExpenses.length} of {crm.marketingExpenses.length}</span>
              </>
            }
            exportFilename="vgg-marketing-expenses"
            pageSize={10}
            emptyMessage="No expenses recorded yet."
            permissions={permissions ? { canExport: permissions.canExport } : undefined}
          />
        </>
      )}

      {/* ===== PAYOUTS TAB ===== */}
      {tab === "payouts" && (
        <>
          <div className="flex justify-end">
            {canEdit && <Button onClick={() => openPayout()}><Plus className="mr-1.5 h-4 w-4" />Record Payout</Button>}
          </div>
          {/* Per-agent payout summary card */}
          <Card className="overflow-x-auto">
            <div className="border-b p-4 font-semibold flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" /> Payout summary per agent</div>
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Agent</th>
                  <th className="p-3">Gross commission</th>
                  <th className="p-3">Approved expenses</th>
                  <th className="p-3">Net payable</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((row) => (
                  <tr className="border-b" key={row.agent.id}>
                    <td className="p-3 font-medium">{row.agent.fullName}</td>
                    <td className="p-3">{inr(row.gross)}</td>
                    <td className="p-3">{inr(row.expenses)}</td>
                    <td className="p-3 font-medium">{inr(row.net)}</td>
                    <td className="p-3">{inr(row.paid)}</td>
                    <td className="p-3"><Badge variant="outline">{inr(row.remaining)}</Badge></td>
                  </tr>
                ))}
                {!agentStats.length && (
                  <tr><td colSpan={6} className="p-5 text-center text-sm text-muted-foreground">No agents yet.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
          {/* Payout history with filter / sort / search */}
          <DataTable
            title="Payout History"
            description="Recorded commission payouts. Click column headers to sort; use the dropdowns to filter."
            columns={payoutColumns}
            rows={filteredPayouts}
            searchPlaceholder="Search by agent, reference, notes..."
            searchKeys={[
              (p) => crm.marketingAgents.find((a) => a.id === p.agentId)?.fullName ?? "",
              (p) => p.paymentReference ?? "",
              (p) => p.notes ?? "",
            ]}
            toolbar={
              <>
                <Select value={payoutStatusFilter} onValueChange={setPayoutStatusFilter}>
                  <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {["pending", "partially_paid", "paid", "on_hold"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replaceAll("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={payoutAgentFilter} onValueChange={setPayoutAgentFilter}>
                  <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="All agents" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {crm.marketingAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{filteredPayouts.length} of {crm.commissionPayouts.length}</span>
              </>
            }
            exportFilename="vgg-marketing-payouts"
            pageSize={10}
            emptyMessage="No payouts recorded yet."
            permissions={permissions ? { canExport: permissions.canExport } : undefined}
          />
        </>
      )}

      {/* ===== PERFORMANCE TAB ===== */}
      {tab === "performance" && (
        <Performance agentStats={agentStats} cadres={crm.marketingCadres} weights={crm.marketingPerformanceSettings} />
      )}

      {/* ===== SETTINGS TAB ===== */}
      {tab === "settings" && (
        <>
          <div className="flex justify-end">
            {canEdit && <Button onClick={() => openCadre()}><Plus className="mr-1.5 h-4 w-4" />Create Cadre</Button>}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {sortedCadres.map((cadre) => (
              <Card key={cadre.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 font-semibold text-amber-700">
                    {iconFor(cadre.icon)} {cadre.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={cadre.active ? "default" : "secondary"}>{cadre.active ? "Active" : "Archived"}</Badge>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Cadre actions">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openCadre(cadre)}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          {cadre.active && (
                            <DropdownMenuItem onClick={() => setArchiveCadreId(cadre.id)}>
                              <Archive className="w-3.5 h-3.5 mr-2" /> Archive
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600 focus:text-rose-700 focus:bg-rose-50" onClick={() => setDeleteCadreId(cadre.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Commission</div>
                    <strong>{cadre.commissionPercentage}%</strong>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Priority</div>
                    <strong>{cadre.priority}</strong>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="p-4">
            <div className="font-semibold">Performance score weighting</div>
            <p className="mt-1 text-sm text-muted-foreground">Configure scoring used by the leaderboard. Weights should total 100%.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {([['salesVolumeWeight', 'Sales volume'], ['revenueWeight', 'Revenue'], ['plotsSoldWeight', 'Plots sold'], ['conversionRateWeight', 'Conversion rate']] as const).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <NumberInput value={crm.marketingPerformanceSettings[key]} onValueChange={(value) => crm.updateMarketingPerformanceSettings({ [key]: value })} allowDecimal />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ===== AGENT DIALOG ===== */}
      <Dialog open={agentDialog} onOpenChange={setAgentDialog}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
            <DialogDescription>Agent records can be archived (to preserve sales history) or deleted if they have no historical sales.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <Field label="Full name *"><Input value={agentForm.fullName} onChange={(e) => setAgentForm({ ...agentForm, fullName: e.target.value })} /></Field>
            <Field label="Phone *"><Input value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} /></Field>
            <Field label="Employee / Agent ID *"><Input value={agentForm.employeeId} onChange={(e) => setAgentForm({ ...agentForm, employeeId: e.target.value })} /></Field>
            <Field label="Joining date"><Input type="date" value={agentForm.joiningDate} onChange={(e) => setAgentForm({ ...agentForm, joiningDate: e.target.value })} /></Field>
            <Field label="Profile photo">
              <Input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setAgentForm((form) => ({ ...form, profilePhoto: String(reader.result ?? "") })); reader.readAsDataURL(file); }} />
            </Field>
            <Field label="Cadre *">
              <Select value={agentForm.cadreId} onValueChange={(cadreId) => setAgentForm({ ...agentForm, cadreId })}>
                <SelectTrigger><SelectValue placeholder="Select cadre" /></SelectTrigger>
                <SelectContent>
                  {activeCadres.map((cadre) => <SelectItem key={cadre.id} value={cadre.id}>{cadre.name} · {cadre.commissionPercentage}%</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email"><Input type="email" value={agentForm.email} onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={agentForm.status} onValueChange={(status) => setAgentForm({ ...agentForm, status: status as MarketingAgent["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["active", "inactive", "suspended", "archived"].map((status) => <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Address"><Input value={agentForm.address} onChange={(e) => setAgentForm({ ...agentForm, address: e.target.value })} /></Field>
            <div className="col-span-2"><Field label="Notes"><Textarea value={agentForm.notes} onChange={(e) => setAgentForm({ ...agentForm, notes: e.target.value })} /></Field></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialog(false)}>Cancel</Button>
            <Button onClick={saveAgent}>Save member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CADRE DIALOG ===== */}
      <Dialog open={cadreDialog} onOpenChange={setCadreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCadre ? "Edit Cadre" : "Create Cadre"}</DialogTitle>
            <DialogDescription>Future sales use the new rate; completed sales retain their saved rate. Commission % supports decimals (e.g. 2.5%).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Cadre name"><Input value={cadreForm.name} onChange={(e) => setCadreForm({ ...cadreForm, name: e.target.value })} /></Field>
            <Field label="Commission percentage (decimals allowed, 0–100)">
              <NumberInput value={cadreForm.commissionPercentage} onValueChange={(commissionPercentage) => setCadreForm({ ...cadreForm, commissionPercentage })} allowDecimal />
            </Field>
            <Field label="Priority (lower number = shown first)">
              <NumberInput value={cadreForm.priority} onValueChange={(priority) => setCadreForm({ ...cadreForm, priority })} allowDecimal />
            </Field>
            <Field label="Priority icon">
              <Select value={cadreForm.icon} onValueChange={(icon) => setCadreForm({ ...cadreForm, icon: icon as MarketingCadre["icon"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["crown", "star", "medal"].map((icon) => <SelectItem value={icon} key={icon} className="capitalize">{icon}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCadreDialog(false)}>Cancel</Button>
            <Button onClick={saveCadre}>Save cadre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== AGENT SALE DIALOG ===== */}
      <Dialog open={saleDialog} onOpenChange={setSaleDialog}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingSale ? "Edit Agent Sale" : "Record Agent Sale"}</DialogTitle>
            <DialogDescription>
              Reference-only — finance sale and plot status are not affected by this form. Pick a booked/reserved plot, optionally narrow by buyer, and adjust the base price if the agent gave an extra discount from their commission. All other money fields (sale amount, discount, payment method) are pulled from finance automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {/* Agent (with synthetic Direct Sales option for company-direct sales) */}
            <Field label="Agent *">
              <Select
                value={saleForm.agentId || "none"}
                onValueChange={(agentId) => setSaleForm({ ...saleForm, agentId: agentId === "none" ? "" : agentId })}
              >
                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Select an agent</SelectItem>
                  <SelectItem value={DIRECT_SALES_AGENT_ID}>
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-primary" /> Direct Sales (Company)
                    </span>
                  </SelectItem>
                  {activeAgents.map((agent) => {
                    const cadre = crm.marketingCadres.find((c) => c.id === agent.cadreId);
                    return (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.fullName} · {cadre?.name ?? ""} ({cadre?.commissionPercentage ?? 0}%)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>

            {/* Buyer — when chosen, the plot dropdown below auto-filters to that buyer's plots */}
            <Field label="Buyer (optional — filters the plot list)">
              <Select
                value={saleForm.customerId || "all"}
                onValueChange={(customerId) => setSaleForm({
                  ...saleForm,
                  customerId: customerId === "all" ? "" : customerId,
                  // Clear the plot if it doesn't belong to the picked buyer.
                  plotId: "",
                  basePrice: 0,
                  extraDiscountFromCommission: 0,
                })}
              >
                <SelectTrigger><SelectValue placeholder="All buyers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All buyers (show all eligible plots)</SelectItem>
                  {/* Only show buyers who actually have a booked/reserved plot. */}
                  {Array.from(new Set(eligiblePlots.map((p) => p.customerId).filter(Boolean)))
                    .map((cid) => crm.customers.find((c) => c.id === cid))
                    .filter((c): c is Customer => !!c)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Plot — only booked or reserved plots; auto-filtered by buyer if a buyer is selected.
                 Disabled when editing (plot is fixed once the sale is recorded). */}
            <div className="col-span-2">
              <Field label="Plot * (booked or reserved only)">
                <Select
                  value={saleForm.plotId || "none"}
                  onValueChange={(plotId) => plotId === "none" ? setSaleForm((f) => ({ ...f, plotId: "" })) : onPlotChange(plotId)}
                  disabled={!!editingSale}
                >
                  <SelectTrigger><SelectValue placeholder="Select a plot" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select a plot</SelectItem>
                    {buyerFilteredPlots.map((plot) => {
                      const proj = crm.projects.find((p) => p.id === plot.projectId);
                      const cust = crm.customers.find((c) => c.id === plot.customerId);
                      const siblings = crm.plots.filter((p) => p.projectId === plot.projectId);
                      const basePrice = computePlotBasePrice(plot, siblings);
                      return (
                        <SelectItem key={plot.id} value={plot.id}>
                          {plot.block}-{plot.plotNumber} · {proj?.name ?? ""} · {cust?.name ?? ""} · base {inr(basePrice)} ({plot.status})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
              {buyerFilteredPlots.length === 0 && (
                <div className="text-[11px] text-amber-700 mt-1">
                  {saleForm.customerId
                    ? "This buyer has no booked or reserved plots. Clear the buyer filter to see all eligible plots."
                    : "No booked or reserved plots available. Book or reserve a plot in finance first."}
                </div>
              )}
            </div>

            <Field label="Sale date">
              <Input type="date" value={saleForm.saleDate} onChange={(e) => setSaleForm({ ...saleForm, saleDate: e.target.value })} />
            </Field>

            {/* Base price — auto-filled from the plot's pure base price
                 (layout block's defaultPricePerUnit × size, IGNORING facing
                 premium + corner premium + extra costs). Editable: lowering
                 it represents an extra discount given from the agent's
                 commission (reduces commission, NOT finance amount). */}
            <Field label="Base price (layout base · no facing/corner premium) — auto-filled, editable for agent discount">
              <NumberInput
                value={saleForm.basePrice}
                onValueChange={onBasePriceEdit}
                format
              />
              {saleForm.extraDiscountFromCommission > 0 && (
                <div className="text-[11px] text-rose-600 mt-1">
                  − {inr(saleForm.extraDiscountFromCommission)} extra discount from agent's commission
                </div>
              )}
            </Field>

            <div className="col-span-2"><Field label="Remarks"><Textarea rows={2} value={saleForm.remarks} onChange={(e) => setSaleForm({ ...saleForm, remarks: e.target.value })} /></Field></div>

            {/* Commission preview — recomputes live based on form state */}
            {(() => {
              if (!saleForm.plotId || !saleForm.basePrice) return null;
              const isDirectSales = saleForm.agentId === DIRECT_SALES_AGENT_ID;
              if (isDirectSales) {
                return (
                  <div className="col-span-2 rounded-md border bg-muted/40 p-3 text-sm">
                    <div className="font-medium">Direct Sales — no commission</div>
                    <div className="mt-1 text-muted-foreground text-xs">Company-direct sales do not attribute commission to any agent.</div>
                  </div>
                );
              }
              const agent = saleForm.agentId ? crm.marketingAgents.find((a) => a.id === saleForm.agentId) : undefined;
              const cadre = agent ? crm.marketingCadres.find((c) => c.id === agent.cadreId) : undefined;
              if (!cadre) return null;
              const effectiveCommissionBase = Math.max(0, saleForm.basePrice);
              const commission = computeCommission(effectiveCommissionBase, cadre.commissionPercentage);
              const plot = crm.plots.find((p) => p.id === saleForm.plotId);
              const siblings = plot ? crm.plots.filter((p) => p.projectId === plot.projectId) : [];
              const defaultBasePrice = computePlotBasePrice(plot, siblings);
              return (
                <div className="col-span-2 rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="font-medium">Commission preview</div>
                  <div className="mt-1 text-muted-foreground">
                    {cadre.commissionPercentage}% × base price {inr(effectiveCommissionBase)} = <strong className="text-foreground">{inr(commission ?? 0)}</strong>
                    {saleForm.extraDiscountFromCommission > 0 && (
                      <span className="ml-2 text-xs text-rose-600">
                        (reduced from {inr(defaultBasePrice)} — agent gave {inr(saleForm.extraDiscountFromCommission)} extra discount)
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Money fields like sale amount, payment method, and registration office are read from finance and not editable here.
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleDialog(false)}>Cancel</Button>
            <Button onClick={saveSale} className="bg-primary">{editingSale ? "Save changes" : "Record sale"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== EXPENSE DIALOG ===== */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Agent Expense"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Agent">
              <Select value={expenseForm.agentId} onValueChange={(agentId) => setExpenseForm({ ...expenseForm, agentId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeAgents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={expenseForm.category} onValueChange={(category) => setExpenseForm({ ...expenseForm, category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount"><NumberInput value={expenseForm.amount} onValueChange={(amount) => setExpenseForm({ ...expenseForm, amount })} format /></Field>
            <Field label="Date"><Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></Field>
            <Field label="Project">
              <Select value={expenseForm.projectId || "none"} onValueChange={(projectId) => setExpenseForm({ ...expenseForm, projectId: projectId === "none" ? "" : projectId })}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {crm.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bill / receipt">
              <Input type="file" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setExpenseForm((form) => ({ ...form, receiptUrl: String(reader.result ?? "") })); reader.readAsDataURL(file); }} />
            </Field>
            {editingExpense && (
              <Field label="Approval status">
                <Select value={expenseForm.status} onValueChange={(status) => setExpenseForm({ ...expenseForm, status: status as MarketingExpense["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending_review", "approved", "rejected", "reimbursed", "deducted_from_commission"].map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">{status.replaceAll("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Description"><Textarea value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>Cancel</Button>
            <Button onClick={saveExpense}>{editingExpense ? "Save changes" : "Submit expense"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== PAYOUT DIALOG ===== */}
      <Dialog open={payoutDialog} onOpenChange={setPayoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPayout ? "Edit Commission Payout" : "Record Commission Payout"}</DialogTitle>
            <DialogDescription>Only approved expenses are deducted from gross commission.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Agent">
              <Select value={payoutForm.agentId} onValueChange={(agentId) => setPayoutForm({ ...payoutForm, agentId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {agentStats.map((row) => (
                    <SelectItem key={row.agent.id} value={row.agent.id}>
                      {row.agent.fullName} · payable {inr(row.remaining)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount"><NumberInput value={payoutForm.amount} onValueChange={(amount) => setPayoutForm({ ...payoutForm, amount })} format /></Field>
            <Field label="Payment date"><Input type="date" value={payoutForm.paymentDate} onChange={(e) => setPayoutForm({ ...payoutForm, paymentDate: e.target.value })} /></Field>
            <Field label="Transaction / reference ID"><Input value={payoutForm.paymentReference} onChange={(e) => setPayoutForm({ ...payoutForm, paymentReference: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={payoutForm.status} onValueChange={(status) => setPayoutForm({ ...payoutForm, status: status as CommissionPayout["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending", "partially_paid", "paid", "on_hold"].map((status) => (
                    <SelectItem key={status} value={status} className="capitalize">{status.replaceAll("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Payment notes"><Textarea value={payoutForm.notes} onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutDialog(false)}>Cancel</Button>
            <Button onClick={savePayout}>{editingPayout ? "Save changes" : "Record payout"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ALERT DIALOGS ===== */}
      <AlertDialog open={!!archiveCadreId} onOpenChange={(open) => !open && setArchiveCadreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this cadre?</AlertDialogTitle>
            <AlertDialogDescription>It can be archived only after all assigned agents are reassigned or archived. Historical commission snapshots are retained.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchiveCadre}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCadreId} onOpenChange={(open) => !open && setDeleteCadreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this cadre permanently?</AlertDialogTitle>
            <AlertDialogDescription>This removes the cadre from the system. Only allowed when no agents (active or archived) are assigned and no historical sales reference it. Use Archive if you want to preserve history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCadre} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAgentId} onOpenChange={(open) => !open && setDeleteAgentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent permanently?</AlertDialogTitle>
            <AlertDialogDescription>Allowed only when the agent has no historical sales. Agents with sales history must be archived instead to preserve commission records. Linked expenses and payouts will also be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAgent} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSaleId} onOpenChange={(open) => !open && setDeleteSaleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent sale record?</AlertDialogTitle>
            <AlertDialogDescription>The Agent Sale entry will be removed and the linked commission will be removed. This does NOT affect the plot's status or finance sales — they are independent. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSale} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteExpenseId} onOpenChange={(open) => !open && setDeleteExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>The expense will be removed from the agent's expense history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteExpense} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePayoutId} onOpenChange={(open) => !open && setDeletePayoutId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payout?</AlertDialogTitle>
            <AlertDialogDescription>The payout will be removed from the agent's payout history. Reversing a paid payout does not automatically change the commission status of the underlying sales.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePayout} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== AGENT DETAIL SIDE-SHEET (full history) ===== */}
      <Sheet open={!!agentDetailId} onOpenChange={(open) => !open && setAgentDetailId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[640px] overflow-y-auto p-0">
          {agentDetail && (
            <>
              <SheetHeader className="p-5 border-b bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-bold text-primary text-lg">
                    {agentDetail.agent.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1">
                    <SheetTitle className="text-lg">{agentDetail.agent.fullName}</SheetTitle>
                    <SheetDescription className="flex items-center gap-2 mt-0.5">
                      {agentDetail.cadre && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          {iconFor(agentDetail.cadre.icon, "w-3 h-3")} {agentDetail.cadre.name} · {agentDetail.cadre.commissionPercentage}%
                        </span>
                      )}
                      <Badge variant="outline" className="capitalize">{agentDetail.agent.status}</Badge>
                    </SheetDescription>
                  </div>
                </div>
                {/* Contact details */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="w-3 h-3" /> {agentDetail.agent.phone}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="w-3 h-3" /> {agentDetail.agent.email || "—"}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <UserCircle className="w-3 h-3" /> Emp ID: {agentDetail.agent.employeeId}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3 h-3" /> Joined {formatDate(agentDetail.agent.joiningDate)}
                  </div>
                  {agentDetail.agent.address && (
                    <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="w-3 h-3" /> {agentDetail.agent.address}
                    </div>
                  )}
                </div>
              </SheetHeader>

              <div className="p-5 space-y-5">
                {/* Revenue summary */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Total revenue generated</div>
                    <div className="text-lg font-bold mt-0.5">{inrCompact(agentDetail.totalRevenue)}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Commission earned</div>
                    <div className="text-lg font-bold mt-0.5">{inrCompact(agentDetail.totalCommission)}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Total expenses</div>
                    <div className="text-lg font-bold mt-0.5">{inrCompact(agentDetail.totalExpenses)}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Net payable</div>
                    <div className="text-lg font-bold mt-0.5 text-primary">{inrCompact(agentDetail.netRemaining)}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Agent sales</div>
                    <div className="text-lg font-bold mt-0.5">{agentDetail.sales.length}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Unique customers</div>
                    <div className="text-lg font-bold mt-0.5">{agentDetail.customers.length}</div>
                  </Card>
                </div>

                {/* Sold plots / transactions */}
                <div>
                  <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Sales history ({agentDetail.sales.length})
                  </div>
                  <div className="space-y-2">
                    {agentDetail.sales.length === 0 && (
                      <div className="text-xs text-muted-foreground p-3 border rounded-md">No sales recorded yet.</div>
                    )}
                    {agentDetail.sales.map((v) => (
                      <div key={v.sale.id} className="p-3 border rounded-md text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{v.plot ? `${v.plot.block}-${v.plot.plotNumber}` : "Referral sale"}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {v.project?.name ?? "—"} · {v.customer?.name ?? "—"} · {formatDate(v.sale.saleDate)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{inr(v.saleAmount)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              base: {inr(v.basePrice)} · comm: {v.commissionPercentage ?? 0}% · {inr(v.commissionAmount ?? 0)}
                            </div>
                            {v.sale.extraDiscountFromCommission ? (
                              <div className="text-[10px] text-rose-600">− {inr(v.sale.extraDiscountFromCommission)} agent disc.</div>
                            ) : null}
                          </div>
                        </div>
                        {v.sale.referenceCode && (
                          <div className="mt-1 font-mono text-[10px] text-primary">{v.sale.referenceCode}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expenses */}
                <div>
                  <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                    <ReceiptText className="w-4 h-4 text-primary" /> Expenses ({agentDetail.expenses.length})
                  </div>
                  <div className="space-y-2">
                    {agentDetail.expenses.length === 0 && (
                      <div className="text-xs text-muted-foreground p-3 border rounded-md">No expenses recorded.</div>
                    )}
                    {agentDetail.expenses.map((e) => (
                      <div key={e.id} className="p-3 border rounded-md text-sm flex justify-between items-start">
                        <div>
                          <div className="font-medium">{e.category}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatDate(e.date)} · <span className="capitalize">{e.status.replaceAll("_", " ")}</span>
                          </div>
                          {e.description && <div className="text-[11px] text-muted-foreground mt-0.5">{e.description}</div>}
                        </div>
                        <div className="font-medium">{inr(e.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payouts */}
                <div>
                  <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                    <WalletCards className="w-4 h-4 text-primary" /> Payouts ({agentDetail.payouts.length})
                  </div>
                  <div className="space-y-2">
                    {agentDetail.payouts.length === 0 && (
                      <div className="text-xs text-muted-foreground p-3 border rounded-md">No payouts recorded.</div>
                    )}
                    {agentDetail.payouts.map((p) => (
                      <div key={p.id} className="p-3 border rounded-md text-sm flex justify-between items-start">
                        <div>
                          <div className="font-medium">{inr(p.amount)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {p.paymentDate ? formatDate(p.paymentDate) : "—"} · <span className="capitalize">{p.status.replaceAll("_", " ")}</span>
                          </div>
                          {p.paymentReference && <div className="font-mono text-[10px] text-primary mt-0.5">{p.paymentReference}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customers */}
                <div>
                  <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                    <Users className="w-4 h-4 text-primary" /> Customers ({agentDetail.customers.length})
                  </div>
                  <div className="space-y-2">
                    {agentDetail.customers.length === 0 && (
                      <div className="text-xs text-muted-foreground p-3 border rounded-md">No linked customers.</div>
                    )}
                    {agentDetail.customers.map((c) => (
                      <div key={c.id} className="p-3 border rounded-md text-sm flex justify-between items-center">
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">{c.phone} · {c.email ?? ""}</div>
                        </div>
                        {c.referenceCode && <div className="font-mono text-[10px] text-primary">{c.referenceCode}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Performance({ agentStats, cadres, weights }: {
  agentStats: Array<{ agent: MarketingAgent; sales: MarketingSaleView[]; gross: number; value: number }>;
  cadres: MarketingCadre[];
  weights: { salesVolumeWeight: number; revenueWeight: number; plotsSoldWeight: number; conversionRateWeight: number };
}) {
  const ranked = useMemo(() => {
    const maxValue = Math.max(1, ...agentStats.map((row) => row.value));
    const maxSales = Math.max(1, ...agentStats.map((row) => row.sales.length));
    return agentStats
      .map((row) => ({
        ...row,
        score: Math.round(
          (row.value / maxValue) * weights.revenueWeight +
          (row.sales.length / maxSales) * (weights.salesVolumeWeight + weights.plotsSoldWeight),
        ),
      }))
      .sort((a, b) => b.score - a.score);
  }, [agentStats, weights]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {ranked.slice(0, 3).map((row, index) => (
          <Card key={row.agent.id} className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"} Rank {index + 1}
            </div>
            <div className="mt-3 text-lg font-bold">{row.agent.fullName}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
              {iconFor(cadres.find((c) => c.id === row.agent.cadreId)?.icon ?? "star")} {cadres.find((c) => c.id === row.agent.cadreId)?.name}
            </div>
            <div className="mt-4 text-sm">{inrCompact(row.value)} revenue · {row.sales.length} plots</div>
            <Progress className="mt-3" value={row.score} />
            <div className="mt-1 text-right text-xs text-muted-foreground">{row.score} score</div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="flex items-center gap-2 font-semibold">
          <TrendingUp className="h-4 w-4 text-primary" /> Team leaderboard
        </div>
        <div className="mt-4 space-y-3">
          {ranked.map((row, index) => (
            <div key={row.agent.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
              <div className="font-bold text-muted-foreground">{index + 1}</div>
              <div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{row.agent.fullName}</span>
                  <span>{inrCompact(row.value)}</span>
                </div>
                <Progress className="mt-1.5" value={row.score} />
              </div>
              <Badge>{row.score}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}



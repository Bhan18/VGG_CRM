
"use client";

import { useCrm } from "@/lib/store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, CalendarCheck, IndianRupee, Calendar, AlertTriangle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { formatDate, inr, allPaymentModes, plotPayments, totalPaidForPlot } from "@/lib/format";
import type { Booking, PaymentMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Permissions } from "@/lib/permissions";

interface PlotAdvance {
  plotId: string;
  advance: number;
}

interface FormState {
  customerId: string;
  bookingDate: string;
  paymentMethod: PaymentMode;
  discount: number;
  expectedRegistrationDate: string;
  bookingExpiry: string;
  remarks: string;
}

const blank: FormState = {
  customerId: "",
  bookingDate: new Date().toISOString().slice(0, 10),
  paymentMethod: "cheque",
  discount: 0,
  expectedRegistrationDate: "",
  bookingExpiry: "",
  remarks: "",
};

export default function BookingsPage({ permissions }: { permissions?: Permissions }) {
  const { bookings, plots, customers, projects, layouts, addBooking, updateBooking, deleteBooking, setRoute, prefillBooking, clearPrefill } = useCrm();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Multi-plot selection with individual advance amounts
  const [selectedPlots, setSelectedPlots] = useState<PlotAdvance[]>([]);
  // True when the dialog was opened via the "Add Buyer" prefill flow
  const [isPrefilled, setIsPrefilled] = useState(false);

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [bookings],
  );

  // Available plots for booking: only "available" status (for new bookings)
  // For edit mode, also include the currently booked/reserved plot
  const availablePlots = plots.filter((p) => p.status === "available" || (editingId && (p.status === "reserved" || p.status === "booked")));

  // Cascading dropdown state: Project → Layout → Block → Plot
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>("");
  const [selectedBlock, setSelectedBlock] = useState<string>("");
  const [showAllCustomers, setShowAllCustomers] = useState(false);

  // Blocks available in the selected layout
  const availableBlocks = useMemo(() => {
    if (!selectedLayoutId) return [];
    return Array.from(new Set(
      plots
        .filter((p) => p.layoutId === selectedLayoutId && p.status === "available")
        .map((p) => p.block)
    )).sort();
  }, [plots, selectedLayoutId]);

  // Recent customers (last 10 added) — shown by default in dropdown
  const recentCustomers = useMemo(() => {
    return [...customers]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [customers]);

  const openAdd = () => {
    setEditingId(null);
    setForm(blank);
    setSelectedProjectId(projects[0]?.id ?? "");
    setSelectedLayoutId("");
    setSelectedBlock("");
    setSelectedPlots([]);
    setShowAllCustomers(false);
    setIsPrefilled(false);
    setDialogOpen(true);
  };

  const openEdit = (b: Booking) => {
    setEditingId(b.id);
    const plot = plots.find((p) => p.id === b.plotId);
    setSelectedProjectId(plot?.projectId ?? "");
    setSelectedLayoutId(plot?.layoutId ?? "");
    setSelectedBlock(plot?.block ?? "");
    setSelectedPlots([{ plotId: b.plotId, advance: b.advancePaid }]);
    setForm({
      customerId: b.customerId,
      bookingDate: b.bookingDate.slice(0, 10),
      paymentMethod: b.paymentMethod,
      discount: b.discount ?? 0,
      expectedRegistrationDate: b.expectedRegistrationDate?.slice(0, 10) ?? "",
      bookingExpiry: b.bookingExpiry?.slice(0, 10) ?? "",
      remarks: b.remarks ?? "",
    });
    setIsPrefilled(false);
    setDialogOpen(true);
  };

  // Auto-open the booking dialog when arriving via the "Add Buyer" flow
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prefillBooking) {
      const { plotId, customerId } = prefillBooking;
      const plot = plots.find((p) => p.id === plotId);
      if (plot) {
        const defaultAdvance = Math.round(plot.totalPrice * 0.1); // 10% advance default
        setEditingId(null);
        setForm({
          ...blank,
          customerId,
          discount: 0,
        });
        // Pre-select this single plot
        setSelectedProjectId(plot.projectId);
        setSelectedLayoutId(plot.layoutId);
        setSelectedBlock(plot.block);
        setSelectedPlots([{ plotId: plot.id, advance: defaultAdvance }]);
        setShowAllCustomers(false);
        setIsPrefilled(true);
        setDialogOpen(true);
        clearPrefill();
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [prefillBooking, plots, clearPrefill]);

  // Minimum advance for "reserved" status (below this = "booked")
  const RESERVE_THRESHOLD = 50000;

  // Toggle plot selection for multi-plot booking
  const togglePlotSelection = (plotId: string) => {
    setSelectedPlots((prev) => {
      const existing = prev.find((p) => p.plotId === plotId);
      if (existing) {
        return prev.filter((p) => p.plotId !== plotId);
      }
      return [...prev, { plotId, advance: 0 }];
    });
  };

  // Update advance amount for a specific plot
  const updatePlotAdvance = (plotId: string, advance: number) => {
    setSelectedPlots((prev) => prev.map((p) => p.plotId === plotId ? { ...p, advance } : p));
  };

  const handleSave = () => {
    if (selectedPlots.length === 0) {
      toast({ title: "Select at least one plot", variant: "destructive" });
      return;
    }
    if (!form.customerId) {
      toast({ title: "Select a customer", variant: "destructive" });
      return;
    }
    // Validate all advances
    for (const sp of selectedPlots) {
      if (sp.advance <= 0) {
        const plot = plots.find((p) => p.id === sp.plotId);
        toast({ title: `Enter advance for Plot ${plot?.plotNumber ?? ""}`, variant: "destructive" });
        return;
      }
    }

    const payload = {
      ...form,
      bookingDate: new Date(form.bookingDate).toISOString(),
      expectedRegistrationDate: form.expectedRegistrationDate ? new Date(form.expectedRegistrationDate).toISOString() : undefined,
      bookingExpiry: form.bookingExpiry ? new Date(form.bookingExpiry).toISOString() : undefined,
      status: "active" as const,
    };

    if (editingId) {
      // Edit mode — update existing single booking
      updateBooking(editingId, { ...payload, plotId: selectedPlots[0].plotId, advancePaid: selectedPlots[0].advance });
      toast({ title: "Booking updated" });
    } else {
      // Create one booking per selected plot
      selectedPlots.forEach((sp) => {
        addBooking({ ...payload, plotId: sp.plotId, advancePaid: sp.advance });
      });
      toast({ title: "Bookings created", description: `${selectedPlots.length} plot(s) booked for ${customers.find((c) => c.id === form.customerId)?.name ?? ""}` });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteBooking(deleteId);
    toast({ title: "Booking deleted", variant: "destructive" });
    setDeleteId(null);
  };

  const columns: DataTableColumn<Booking>[] = [
    {
      key: "ref",
      header: "Reference Code",
      sortable: true,
      sortValue: (b) => b.referenceCode ?? "",
      render: (b) => (
        <div className="font-mono text-[11px] font-semibold text-primary">{b.referenceCode ?? "—"}</div>
      ),
    },
    {
      key: "plot",
      header: "Plot",
      sortable: true,
      sortValue: (b) => plots.find((p) => p.id === b.plotId)?.plotNumber ?? "",
      render: (b) => {
        const plot = plots.find((p) => p.id === b.plotId);
        const layout = layouts.find((l) => l.id === plot?.layoutId);
        return (
          <div>
            <div className="font-medium text-sm">Plot {plot?.plotNumber ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">{layout?.name} · Block {plot?.block}</div>
          </div>
        );
      },
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (b) => customers.find((c) => c.id === b.customerId)?.name ?? "",
      render: (b) => {
        const c = customers.find((c) => c.id === b.customerId);
        return (
          <div>
            <div className="font-medium text-sm">{c?.name ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">{c?.phone}</div>
          </div>
        );
      },
    },
    {
      key: "date",
      header: "Booking Date",
      sortable: true,
      sortValue: (b) => b.bookingDate,
      render: (b) => <span className="text-xs">{formatDate(b.bookingDate)}</span>,
    },
    {
      key: "advance",
      header: "Advance",
      sortable: true,
      sortValue: (b) => b.advancePaid,
      render: (b) => <span className="font-semibold text-emerald-700 text-sm">{inr(b.advancePaid)}</span>,
    },
    {
      key: "discount",
      header: "Discount",
      sortable: true,
      sortValue: (b) => b.discount ?? 0,
      render: (b) => (b.discount ?? 0) > 0
        ? <span className="font-semibold text-rose-600 text-sm">−{inr(b.discount)}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "expiry",
      header: "Expiry",
      sortable: true,
      sortValue: (b) => b.bookingExpiry ?? "",
      render: (b) => {
        if (!b.bookingExpiry) return <span className="text-xs text-muted-foreground">—</span>;
        const days = Math.ceil((new Date(b.bookingExpiry).getTime() - Date.now()) / 86400000);
        const expired = days < 0;
        return (
          <div>
            <div className="text-xs">{formatDate(b.bookingExpiry)}</div>
            <Badge
              variant="outline"
              className={`text-[10px] mt-0.5 ${
                expired
                  ? "bg-rose-50 text-rose-700 border-transparent"
                  : days <= 7
                  ? "bg-amber-50 text-amber-700 border-transparent"
                  : "bg-sky-50 text-sky-700 border-transparent"
              }`}
            >
              {expired ? "Expired" : days === 0 ? "Today" : `${days}d left`}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Plot Status",
      render: (b) => {
        const plot = plots.find((p) => p.id === b.plotId);
        return plot ? <StatusBadge status={plot.status} /> : <span className="text-xs">—</span>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (b) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              setRoute("interactive-layout", {
                selectedProjectId: plots.find((p) => p.id === b.plotId)?.projectId,
                selectedLayoutId: plots.find((p) => p.id === b.plotId)?.layoutId,
                selectedPlotId: b.plotId,
              });
            }}
          >
            View
          </Button>
          {permissions?.canCreateBookings !== false && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(b)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {permissions?.canDeleteData && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
              onClick={() => setDeleteId(b.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Bookings"
        description="Reserve plots for buyers. Booking automatically changes plot status to Reserved."
        actions={
          permissions?.canCreateBookings !== false ? (
            <Button onClick={openAdd} className="bg-primary">
              <Plus className="w-4 h-4 mr-1.5" /> New Booking
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Bookings</div>
          <div className="text-xl font-bold mt-1">{bookings.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Active</div>
          <div className="text-xl font-bold mt-1 text-sky-700">
            {bookings.filter((b) => b.status === "active").length}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Advance</div>
          <div className="text-xl font-bold mt-1 text-emerald-700">
            {inr(bookings.reduce((s, b) => s + b.advancePaid, 0))}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Expiring ≤ 7 days</div>
          <div className="text-xl font-bold mt-1 text-amber-700">
            {
              bookings.filter((b) => {
                if (!b.bookingExpiry) return false;
                const days = Math.ceil((new Date(b.bookingExpiry).getTime() - Date.now()) / 86400000);
                return days >= 0 && days <= 7;
              }).length
            }
          </div>
        </Card>
      </div>

      <DataTable
        title="All Bookings"
        columns={columns}
        rows={sortedBookings}
        searchPlaceholder="Search by plot, customer..."
        searchKeys={[
          (b) => plots.find((p) => p.id === b.plotId)?.plotNumber ?? "",
          (b) => customers.find((c) => c.id === b.customerId)?.name ?? "",
          (b) => customers.find((c) => c.id === b.customerId)?.phone ?? "",
        ]}
        exportFilename="vgg-bookings"
        pageSize={10}
        onRowClick={(b) => openEdit(b)}
        permissions={permissions ? { canExport: permissions.canExport } : undefined}
      />

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setIsPrefilled(false); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isPrefilled ? "New Booking (Add Buyer Flow)" : editingId ? "Edit Booking" : "New Booking"}</DialogTitle>
            <DialogDescription>
              {isPrefilled
                ? "Plot and customer are prefilled from the Add Buyer flow. Enter the advance amount and remaining details."
                : "Booking a plot will automatically change its status to \"Reserved\" and link the customer."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {/* Prefilled read-only plot summary */}
            {isPrefilled && (() => {
              const plot = plots.find((p) => p.id === selectedPlots[0]?.plotId);
              const project = projects.find((p) => p.id === plot?.projectId);
              const layout = layouts.find((l) => l.id === plot?.layoutId);
              const cust = customers.find((c) => c.id === form.customerId);
              if (!plot) return null;
              return (
                <div className="p-3 rounded-md border border-primary/30 bg-primary/5 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-primary text-sm">
                    <CalendarCheck className="w-4 h-4" />
                    Prefilled Plot & Buyer
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div><span className="text-muted-foreground">Plot:</span> <span className="font-medium">{plot.plotNumber}</span></div>
                    <div><span className="text-muted-foreground">Block:</span> <span className="font-medium">{plot.block}</span></div>
                    <div><span className="text-muted-foreground">Size:</span> <span className="font-medium">{plot.size} {plot.sizeUnit}</span></div>
                    <div><span className="text-muted-foreground">Total Price:</span> <span className="font-medium">{inr(plot.totalPrice)}</span></div>
                    <div><span className="text-muted-foreground">Project:</span> <span className="font-medium">{project?.name ?? "—"}</span></div>
                    <div><span className="text-muted-foreground">Layout:</span> <span className="font-medium">{layout?.name ?? "—"}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Buyer:</span> <span className="font-medium">{cust?.name ?? "—"} · {cust?.phone ?? ""}</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Cascading: Project → Layout → Block → Multi-Plot Selection */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Project *</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={(v) => {
                    setSelectedProjectId(v);
                    setSelectedLayoutId("");
                    setSelectedBlock("");
                    setSelectedPlots([]);
                  }}
                  disabled={!!editingId || isPrefilled}
                >
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Layout *</Label>
                <Select
                  value={selectedLayoutId}
                  onValueChange={(v) => { setSelectedLayoutId(v); setSelectedBlock(""); setSelectedPlots([]); }}
                  disabled={!!editingId || isPrefilled || !selectedProjectId}
                >
                  <SelectTrigger><SelectValue placeholder="Select layout" /></SelectTrigger>
                  <SelectContent>
                    {layouts.filter((l) => l.projectId === selectedProjectId).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Block</Label>
                <Select
                  value={selectedBlock}
                  onValueChange={(v) => { setSelectedBlock(v); setSelectedPlots([]); }}
                  disabled={!!editingId || isPrefilled || !selectedLayoutId}
                >
                  <SelectTrigger><SelectValue placeholder="All blocks" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Blocks</SelectItem>
                    {availableBlocks.map((b) => (<SelectItem key={b} value={b}>Block {b}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Multi-plot selection grid — hidden when prefilled (single plot already chosen) */}
            {selectedLayoutId && !isPrefilled && (
              <div>
                <Label className="text-xs">Select Plots (click to select multiple) *</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-32 overflow-y-auto p-2 border border-border rounded-md bg-muted/30">
                  {availablePlots
                    .filter((p) => p.layoutId === selectedLayoutId && (!selectedBlock || p.block === selectedBlock) && p.status === "available")
                    .map((p) => {
                      const isSelected = selectedPlots.some((sp) => sp.plotId === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlotSelection(p.id)}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                            isSelected ? "bg-primary text-primary-foreground ring-2 ring-accent" : "bg-card border border-border hover:bg-muted/60"
                          }`}
                        >
                          {p.plotNumber}
                        </button>
                      );
                    })}
                  {availablePlots.filter((p) => p.layoutId === selectedLayoutId && (!selectedBlock || p.block === selectedBlock) && p.status === "available").length === 0 && (
                    <span className="text-xs text-muted-foreground p-1">No available plots in this block/layout</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{selectedPlots.length} plot(s) selected</div>
              </div>
            )}

            {/* Individual advance payment fields for each selected plot */}
            {selectedPlots.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Advance Payments (per plot)</Label>
                {selectedPlots.map((sp) => {
                  const plot = plots.find((p) => p.id === sp.plotId);
                  return (
                    <div key={sp.plotId} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card">
                      <div className="flex-1">
                        <div className="text-sm font-medium">Plot {plot?.plotNumber}</div>
                        <div className="text-[10px] text-muted-foreground">Block {plot?.block} · {plot?.size} {plot?.sizeUnit} · {inr(plot?.totalPrice ?? 0)}</div>
                      </div>
                      <div className="w-40">
                        <NumberInput
                          value={sp.advance}
                          onValueChange={(v) => updatePlotAdvance(sp.plotId, v)}
                          format
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-600" onClick={() => togglePlotSelection(sp.plotId)}>
                        ✕
                      </Button>
                      {sp.advance > 0 && sp.advance < RESERVE_THRESHOLD && (
                        <span className="text-[9px] text-amber-600">Booked</span>
                      )}
                      {sp.advance >= RESERVE_THRESHOLD && (
                        <span className="text-[9px] text-emerald-600">Reserved</span>
                      )}
                    </div>
                  );
                })}
                <div className="text-xs font-semibold text-right p-1">
                  Total Advance: {inr(selectedPlots.reduce((sum, sp) => sum + sp.advance, 0))}
                </div>
              </div>
            )}

            {/* Customer selection — recent by default, toggle to view all */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Customer *</Label>
                {!isPrefilled && (
                  <button
                    type="button"
                    onClick={() => setShowAllCustomers((v) => !v)}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {showAllCustomers ? "Show recent only" : `View all (${customers.length})`}
                  </button>
                )}
              </div>
              <Select
                value={form.customerId}
                onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))}
                disabled={isPrefilled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {(showAllCustomers ? customers : recentCustomers).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isPrefilled && !showAllCustomers && recentCustomers.length < customers.length && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  Showing {recentCustomers.length} recent customers. Click "View all" to see all {customers.length}.
                </div>
              )}
              {isPrefilled && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  Buyer is prefilled from the Add Buyer flow.
                </div>
              )}
            </div>

            {/* Plot summary + total advance — replaces the broken single-plot fields.
                The per-plot advance inputs are already rendered above (in the multi-plot section).
                Here we show a read-only total so the user can see the combined advance. */}
            {selectedPlots.length > 0 && (() => {
              const totalAdvance = selectedPlots.reduce((sum, sp) => sum + (sp.advance || 0), 0);
              const totalPlotPrice = selectedPlots.reduce((sum, sp) => {
                const plot = plots.find((p) => p.id === sp.plotId);
                return sum + (plot?.totalPrice ?? 0);
              }, 0);
              return (
                <div className="p-2.5 rounded-md bg-muted/50 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {selectedPlots.length} plot{selectedPlots.length !== 1 ? "s" : ""} selected · Total plot value
                    </span>
                    <span className="font-semibold">{inr(totalPlotPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Advance Paid</span>
                    <span className="font-semibold text-primary">{inr(totalAdvance)}</span>
                  </div>
                  {totalAdvance > 0 && totalAdvance < RESERVE_THRESHOLD && (
                    <div className="text-[10px] text-amber-600 mt-1">
                      Plots will be marked as <strong>Booked</strong> (advance &lt; ₹{RESERVE_THRESHOLD.toLocaleString("en-IN")} per plot threshold)
                    </div>
                  )}
                  {totalAdvance >= RESERVE_THRESHOLD && (
                    <div className="text-[10px] text-emerald-600 mt-1">
                      Plots will be marked as <strong>Reserved</strong> (advance ≥ ₹{RESERVE_THRESHOLD.toLocaleString("en-IN")} per plot threshold)
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Booking Date *</Label>
                <Input type="date" value={form.bookingDate} onChange={(e) => setForm((f) => ({ ...f, bookingDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Discount (₹)</Label>
                <NumberInput
                  value={form.discount}
                  onValueChange={(v) => setForm((f) => ({ ...f, discount: v }))}
                  format
                  className="h-9"
                  placeholder="0"
                />
                <div className="text-[10px] text-muted-foreground mt-1">
                  Discount given at booking. Carried forward to sale.
                </div>
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v as PaymentMode }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allPaymentModes.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Booking Expiry</Label>
                <Input type="date" value={form.bookingExpiry} onChange={(e) => setForm((f) => ({ ...f, bookingExpiry: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Expected Registration Date</Label>
                <Input type="date" value={form.expectedRegistrationDate} onChange={(e) => setForm((f) => ({ ...f, expectedRegistrationDate: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Remarks</Label>
                <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary">
              {editingId ? "Save Changes" : "Create Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              The plot will become available again. The customer record will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



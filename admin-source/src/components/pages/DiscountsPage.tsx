
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag, Search, Filter, Plus, IndianRupee, TrendingDown, Wallet } from "lucide-react";
import { useState, useMemo } from "react";
import {
  inr,
  inrCompact,
  formatDate,
  outstandingForPlot,
  totalPaidForPlot,
  plotCustomer,
  plotBooking,
} from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Plot } from "@/lib/types";
import type { Permissions } from "@/lib/permissions";

interface DiscountFormState {
  discount: number;
  remarks: string;
}

const blank: DiscountFormState = { discount: 0, remarks: "" };

export default function DiscountsPage({ permissions }: { permissions?: Permissions }) {
  const { plots, customers, bookings, sales, payments, projects, layouts, updateBooking } = useCrm();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);
  const [form, setForm] = useState<DiscountFormState>(blank);

  // Filters
  const [filterProject, setFilterProject] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [plotQuery, setPlotQuery] = useState<string>("");

  const canEdit = permissions?.canCreateBookings !== false;

  // List of booked + reserved plots (active discounts apply to bookings, not sales)
  const eligiblePlots = useMemo(() => {
    return plots.filter((p) => p.status === "booked" || p.status === "reserved");
  }, [plots]);

  // Apply filters
  const filteredPlots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pq = plotQuery.trim().toLowerCase();
    return eligiblePlots
      .filter((p) => filterProject === "all" || p.projectId === filterProject)
      .filter((p) => {
        if (!q) return true;
        const cust = plotCustomer(p, customers);
        return cust?.name?.toLowerCase().includes(q) ?? false;
      })
      .filter((p) => {
        if (!pq) return true;
        return p.plotNumber.toLowerCase().includes(pq);
      });
  }, [eligiblePlots, filterProject, searchQuery, plotQuery, customers]);

  // Summary metrics — across all eligible plots (not filtered)
  const totals = useMemo(() => {
    let totalDiscount = 0;
    let totalOutstanding = 0;
    let totalPaid = 0;
    let totalValue = 0;
    for (const p of eligiblePlots) {
      const booking = plotBooking(p, bookings);
      totalDiscount += booking?.discount ?? 0;
      totalOutstanding += outstandingForPlot(p, payments, bookings, sales);
      totalPaid += totalPaidForPlot(p, payments);
      totalValue += p.totalPrice;
    }
    return { totalDiscount, totalOutstanding, totalPaid, totalValue };
  }, [eligiblePlots, bookings, sales, payments]);

  const openAddDiscount = (plot: Plot) => {
    const booking = plotBooking(plot, bookings);
    setEditingPlotId(plot.id);
    setForm({
      discount: booking?.discount ?? 0,
      remarks: booking?.remarks ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingPlotId) return;
    const plot = plots.find((p) => p.id === editingPlotId);
    if (!plot) return;
    const booking = plotBooking(plot, bookings);
    if (!booking) {
      toast({
        title: "No active booking",
        description: "Only booked/reserved plots with a booking can be discounted.",
        variant: "destructive",
      });
      return;
    }
    if (form.discount < 0) {
      toast({ title: "Discount cannot be negative", variant: "destructive" });
      return;
    }
    if (form.discount > plot.totalPrice) {
      toast({
        title: "Discount exceeds total price",
        description: `Maximum allowed is ${inr(plot.totalPrice)}.`,
        variant: "destructive",
      });
      return;
    }
    // Update the booking's discount (REPLACES, not adds)
    // Also append remarks if provided so the change is auditable.
    const newRemarks = form.remarks.trim()
      ? `${booking.remarks ? booking.remarks + " | " : ""}[${new Date().toISOString().slice(0, 10)}] ${form.remarks.trim()}`
      : booking.remarks;
    updateBooking(booking.id, {
      discount: form.discount,
      remarks: newRemarks,
    });
    toast({
      title: "Discount updated",
      description: `${plot.plotNumber} — new discount ${inr(form.discount)}`,
    });
    setDialogOpen(false);
    setEditingPlotId(null);
  };

  // Dialog live preview values
  const dialogPlot = editingPlotId ? plots.find((p) => p.id === editingPlotId) : undefined;
  const dialogBooking = dialogPlot ? plotBooking(dialogPlot, bookings) : undefined;
  const dialogCustomer = dialogPlot ? plotCustomer(dialogPlot, customers) : undefined;
  const dialogProject = dialogPlot ? projects.find((p) => p.id === dialogPlot.projectId) : undefined;
  const dialogPaid = dialogPlot ? totalPaidForPlot(dialogPlot, payments) : 0;
  const dialogExistingDiscount = dialogBooking?.discount ?? 0;
  const dialogOutstandingBefore =
    dialogPlot && dialogBooking
      ? outstandingForPlot(dialogPlot, payments, bookings, sales)
      : 0;
  // Live preview: replace existing discount with the new value
  const dialogNewOutstanding =
    dialogPlot && dialogBooking
      ? Math.max(
          0,
          Math.max(0, dialogPlot.totalPrice - form.discount) - dialogPaid,
        )
      : 0;
  const dialogDelta = form.discount - dialogExistingDiscount;

  const columns: DataTableColumn<Plot>[] = [
    {
      key: "plot",
      header: "Plot",
      sortable: true,
      sortValue: (p) => p.plotNumber,
      render: (p) => (
        <div>
          <div className="font-semibold text-sm">{p.plotNumber}</div>
          <div className="text-[11px] text-muted-foreground">Block {p.block}</div>
        </div>
      ),
    },
    {
      key: "project",
      header: "Project",
      sortable: true,
      sortValue: (p) => projects.find((x) => x.id === p.projectId)?.name ?? "",
      render: (p) => {
        const proj = projects.find((x) => x.id === p.projectId);
        return (
          <div className="text-xs">
            <div className="font-medium">{proj?.name ?? "—"}</div>
            <div className="text-muted-foreground">{proj?.location ?? ""}</div>
          </div>
        );
      },
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (p) => plotCustomer(p, customers)?.name ?? "",
      render: (p) => {
        const c = plotCustomer(p, customers);
        return c ? (
          <div className="text-xs">
            <div className="font-medium">{c.name}</div>
            <div className="text-muted-foreground">{c.phone}</div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "totalPrice",
      header: "Total Price",
      sortable: true,
      sortValue: (p) => p.totalPrice,
      render: (p) => <span className="text-sm font-medium">{inr(p.totalPrice)}</span>,
    },
    {
      key: "advance",
      header: "Advance",
      render: (p) => {
        const b = plotBooking(p, bookings);
        return b ? (
          <span className="text-sm text-emerald-700">{inr(b.advancePaid)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "paid",
      header: "Total Paid",
      sortable: true,
      sortValue: (p) => totalPaidForPlot(p, payments),
      render: (p) => {
        const paid = totalPaidForPlot(p, payments);
        return <span className="text-sm font-medium text-emerald-700">{inr(paid)}</span>;
      },
    },
    {
      key: "discount",
      header: "Discount",
      sortable: true,
      sortValue: (p) => plotBooking(p, bookings)?.discount ?? 0,
      render: (p) => {
        const b = plotBooking(p, bookings);
        const d = b?.discount ?? 0;
        return d > 0 ? (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-transparent gap-1">
            <TrendingDown className="w-3 h-3" />
            {inrCompact(d)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "outstanding",
      header: "Outstanding",
      sortable: true,
      sortValue: (p) => outstandingForPlot(p, payments, bookings, sales),
      render: (p) => {
        const out = outstandingForPlot(p, payments, bookings, sales);
        return (
          <span className={`text-sm font-semibold ${out > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {inr(out)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (p) => (
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => openAddDiscount(p)}
          disabled={!canEdit}
        >
          <Tag className="w-3.5 h-3.5 mr-1.5" />
          {plotBooking(p, bookings)?.discount ? "Edit Discount" : "Add Discount"}
        </Button>
      ),
    },
  ];

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Discounts"
        description="Manage booking-level discounts for booked and reserved plots. Discounts are automatically deducted from the outstanding balance."
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Tag className="w-3 h-3" /> Total Discounts
          </div>
          <div className="text-xl font-bold mt-1 text-rose-700">{inrCompact(totals.totalDiscount)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">across {eligiblePlots.length} plots</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Wallet className="w-3 h-3" /> Outstanding After Discounts
          </div>
          <div className="text-xl font-bold mt-1 text-rose-700">{inrCompact(totals.totalOutstanding)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">net receivable</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <IndianRupee className="w-3 h-3" /> Total Collected
          </div>
          <div className="text-xl font-bold mt-1 text-emerald-700">{inrCompact(totals.totalPaid)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">from bookings</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <TrendingDown className="w-3 h-3" /> Gross Value
          </div>
          <div className="text-xl font-bold mt-1">{inrCompact(totals.totalValue)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {totals.totalValue > 0
              ? `${((totals.totalDiscount / totals.totalValue) * 100).toFixed(1)}% discounted`
              : "—"}
          </div>
        </Card>
      </div>

      <DataTable
        title="Discounted Bookings"
        description="Booked and reserved plots. Edit the booking discount to adjust the outstanding balance."
        columns={columns}
        rows={filteredPlots}
        exportFilename="vgg-discounts"
        pageSize={10}
        emptyMessage="No booked or reserved plots match your filters."
        permissions={permissions ? { canExport: permissions.canExport } : undefined}
        toolbar={
          <>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Project:</span>
            </div>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer..."
                className="pl-8 h-8 w-44 text-xs"
              />
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={plotQuery}
                onChange={(e) => setPlotQuery(e.target.value)}
                placeholder="Search plot no..."
                className="pl-8 h-8 w-40 text-xs"
              />
            </div>
          </>
        }
      />

      {/* Add/Edit Discount Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingPlotId(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              {dialogExistingDiscount > 0 ? "Edit Discount" : "Add Discount"}
            </DialogTitle>
            <DialogDescription>
              Update the booking discount. This replaces the existing discount and adjusts the outstanding balance automatically.
            </DialogDescription>
          </DialogHeader>

          {dialogPlot && (
            <div className="grid gap-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
              {/* Prefilled read-only plot + customer info */}
              <div className="p-3 rounded-md border border-primary/30 bg-primary/5 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-primary text-sm">
                  <Plus className="w-4 h-4" />
                  Booking Details
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div>
                    <span className="text-muted-foreground">Plot:</span>{" "}
                    <span className="font-medium">{dialogPlot.plotNumber} · Block {dialogPlot.block}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Project:</span>{" "}
                    <span className="font-medium">{dialogProject?.name ?? "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Customer:</span>{" "}
                    <span className="font-medium">
                      {dialogCustomer?.name ?? "—"}
                      {dialogCustomer?.phone ? ` · ${dialogCustomer.phone}` : ""}
                    </span>
                  </div>
                  {dialogBooking && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Booking Date:</span>{" "}
                      <span className="font-medium">{formatDate(dialogBooking.bookingDate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial summary */}
              <div className="p-3 rounded-md bg-muted/50 text-xs grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <div className="text-muted-foreground">Total Price</div>
                  <div className="font-semibold">{inr(dialogPlot.totalPrice)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Already Paid</div>
                  <div className="font-semibold text-emerald-700">{inr(dialogPaid)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Existing Discount</div>
                  <div className={`font-semibold ${dialogExistingDiscount > 0 ? "text-rose-700" : ""}`}>
                    {dialogExistingDiscount > 0 ? `−${inr(dialogExistingDiscount)}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Current Outstanding</div>
                  <div className="font-semibold text-rose-700">{inr(dialogOutstandingBefore)}</div>
                </div>
              </div>

              {/* Discount input */}
              <div className="space-y-2">
                <Label className="text-xs">
                  Discount Amount (₹) <span className="text-rose-600">*</span>
                </Label>
                <NumberInput
                  value={form.discount}
                  onValueChange={(v) => setForm((f) => ({ ...f, discount: v }))}
                  format
                  autoFocus
                  className={form.discount > 0 ? "ring-2 ring-rose-200 border-rose-400" : ""}
                />
                {dialogDelta !== 0 && form.discount !== dialogExistingDiscount && (
                  <div className="text-[11px] text-muted-foreground">
                    {dialogDelta > 0 ? (
                      <span className="text-rose-600">
                        ↑ Increasing discount by {inr(dialogDelta)}
                      </span>
                    ) : (
                      <span className="text-emerald-600">
                        ↓ Decreasing discount by {inr(Math.abs(dialogDelta))}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Live outstanding preview */}
              <div className="p-3 rounded-md border border-rose-200 bg-rose-50/50 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">New Outstanding Balance</span>
                  <span className="text-base font-bold text-rose-700">{inr(dialogNewOutstanding)}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  = max(0, {inr(dialogPlot.totalPrice)} − {inr(form.discount)}) − {inr(dialogPaid)}
                </div>
              </div>

              {/* Reason / Notes */}
              <div className="space-y-2">
                <Label className="text-xs">Reason / Notes (optional)</Label>
                <Textarea
                  rows={3}
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                  placeholder="e.g. Festive season offer, early-bird discount, negotiated settlement…"
                />
                <div className="text-[10px] text-muted-foreground">
                  Notes are appended to the booking&apos;s remarks with a timestamp.
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary" disabled={!canEdit}>
              <Tag className="w-3.5 h-3.5 mr-1.5" />
              Save Discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




"use client";

import { useCrm } from "@/lib/store";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Save, Pencil, Trash2, Printer, X, User, MapPin, Wallet, Calendar,
  FileText, IndianRupee, Phone, Mail, IdCard, UserPlus, ChevronRight, Calculator,
} from "lucide-react";
import { useState } from "react";
import {
  inr, formatDate, statusColor, allStatuses, allFacings, allPaymentModes,
  plotCustomer, plotBooking, plotSale, plotPayments, totalPaidForPlot,
  outstandingForPlot, printHTML, RESERVE_THRESHOLD,
} from "@/lib/format";
import type { Plot, PlotStatus, FacingDirection, Customer, PaymentMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EMICalculator } from "@/components/shared/EMICalculator";

interface Props {
  plotId: string | undefined;
  onClose: () => void;
}

export default function PlotDetailsPanel({ plotId, onClose }: Props) {
  const {
    plots, customers, bookings, sales, payments, users,
    updatePlot, deletePlot, setPlotStatus, setRoute,
    projects, layouts, addCustomer, addBooking, addPayment,
    settings,
  } = useCrm();
  const { toast } = useToast();

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<Plot>>({});
  // In-page dialog state — no page redirect
  const [dialogMode, setDialogMode] = useState<null | "addBuyer" | "recordPayment">(null);
  const [emiOpen, setEmiOpen] = useState(false);

  const plot = plots.find((p) => p.id === plotId);
  if (!plot) return null;

  const project = projects.find((p) => p.id === plot.projectId);
  const layout = layouts.find((l) => l.id === plot.layoutId);
  const customer = plotCustomer(plot, customers);
  const booking = plotBooking(plot, bookings);
  const sale = plotSale(plot, sales);
  // BUSINESS RULE: when a booking is cancelled/taken back, the plot details
  // panel must ERASE the previous booking AND the entire payment history —
  // show the plot as available with no transaction info. Only render payment
  // history when there's an active booking or sale. The Payments page still
  // preserves the audit trail (negative reversal rows in red).
  const plotPays = (booking || sale) ? plotPayments(plot, payments) : [];
  const totalPaid = (booking || sale) ? totalPaidForPlot(plot, payments) : 0;
  const outstanding = (booking || sale) ? outstandingForPlot(plot, payments, bookings, sales) : 0;

  const startEdit = () => {
    setForm({
      plotNumber: plot.plotNumber, block: plot.block, size: plot.size,
      sizeUnit: plot.sizeUnit, facing: plot.facing, pricePerCent: plot.pricePerCent,
      totalPrice: plot.totalPrice, status: plot.status, cornerPlot: plot.cornerPlot,
      roadWidth: plot.roadWidth, notes: plot.notes,
    });
    setEditMode(true);
  };

  const handleSave = () => {
    if (!form.plotNumber) { toast({ title: "Plot number is required", variant: "destructive" }); return; }
    updatePlot(plot.id, form);
    if (form.status && form.status !== plot.status) setPlotStatus(plot.id, form.status as PlotStatus);
    toast({ title: "Plot updated", description: `Plot ${form.plotNumber}` });
    setEditMode(false);
  };

  const handleDelete = () => {
    deletePlot(plot.id);
    toast({ title: "Plot deleted", description: plot.plotNumber, variant: "destructive" });
    onClose();
  };

  // Quick status change with intelligent triggers
  const handleQuickStatus = (newStatus: PlotStatus) => {
    if (newStatus === plot.status) return;

    // Available → Booked or Reserved: trigger Add Buyer flow
    if (plot.status === "available" && (newStatus === "booked" || newStatus === "reserved")) {
      setDialogMode("addBuyer");
      return;
    }

    // Booked → Reserved: trigger Record Payment flow
    if (plot.status === "booked" && newStatus === "reserved") {
      if (!customer) {
        toast({ title: "No buyer linked to this plot", variant: "destructive" });
        return;
      }
      setDialogMode("recordPayment");
      return;
    }

    // All other transitions: just change status directly
    setPlotStatus(plot.id, newStatus);
    toast({ title: "Status updated", description: `${plot.plotNumber} → ${statusColor[newStatus].label}` });
  };

  const handlePrint = () => {
    const body = `
      <h2 style="margin-bottom:4px">Plot ${plot.plotNumber}</h2>
      <div style="color:#64748b;margin-bottom:16px">${project?.name ?? ""} · ${layout?.name ?? ""}</div>
      <table>
        <tr><th>Block</th><td>${plot.block}</td></tr>
        <tr><th>Size</th><td>${plot.size} ${plot.sizeUnit}</td></tr>
        <tr><th>Facing</th><td>${plot.facing}</td></tr>
        <tr><th>Corner Plot</th><td>${plot.cornerPlot ? "Yes" : "No"}</td></tr>
        <tr><th>Road Width</th><td>${plot.roadWidth} ft</td></tr>
        <tr><th>Price per cent</th><td>${inr(plot.pricePerCent)}</td></tr>
        <tr><th>Total Price</th><td>${inr(plot.totalPrice)}</td></tr>
        <tr><th>Status</th><td>${statusColor[plot.status].label}</td></tr>
        ${customer ? `<tr><th>Owner</th><td>${customer.name} · ${customer.phone}</td></tr>` : ""}
        ${sale ? `<tr><th>Sale Date</th><td>${formatDate(sale.saleDate)}</td></tr><tr><th>Registration #</th><td>${sale.registrationNumber ?? "—"}</td></tr>` : ""}
        <tr><th>Total Paid</th><td>${inr(totalPaid)}</td></tr>
        <tr><th>Outstanding</th><td>${inr(outstanding)}</td></tr>
      </table>
      ${plot.notes ? `<div style="margin-top:16px"><strong>Notes:</strong> ${plot.notes}</div>` : ""}
    `;
    printHTML(`Plot ${plot.plotNumber} - Details`, body);
  };

  return (
    <>
      <Sheet open={!!plotId} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto p-0">
          <SheetHeader className="p-5 pb-3 border-b border-border sticky top-0 bg-background z-10">
            <div className="flex items-start justify-between gap-2 pr-6">
              <div className="min-w-0">
                <SheetTitle className="text-lg">Plot {editMode ? "Editor" : plot.plotNumber}</SheetTitle>
                <SheetDescription className="text-xs">
                  {project?.name} · {layout?.name}{editMode ? " · Edit mode" : ""}
                </SheetDescription>
              </div>
              <StatusBadge status={plot.status} />
            </div>
          </SheetHeader>

          <div className="p-5 space-y-5">
            {!editMode ? (
              <>
                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Size</div>
                    <div className="text-sm font-semibold mt-0.5">{plot.size}</div>
                    <div className="text-[10px] text-muted-foreground">{plot.sizeUnit}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Block</div>
                    <div className="text-sm font-semibold mt-0.5">{plot.block}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Facing</div>
                    <div className="text-sm font-semibold mt-0.5">{plot.facing.split("-")[0]}</div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="p-3 rounded-lg border border-border bg-gradient-to-br from-primary/5 to-accent/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Price per {plot.sizeUnit === "sqyd" ? "sq yd" : "cent"}</div>
                      <div className="text-base font-semibold">{inr(plot.pricePerCent)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-muted-foreground">Total Price</div>
                      <div className="text-base font-bold text-primary">{inr(plot.totalPrice)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Road: {plot.roadWidth} ft</span>
                    <span>·</span><span>Corner: {plot.cornerPlot ? "Yes" : "No"}</span>
                  </div>
                </div>

                {/* Quick Status Change — with intelligent triggers */}
                <div>
                  <Label className="text-xs">Quick Status Change</Label>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {allStatuses.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleQuickStatus(s)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                          plot.status === s
                            ? `${statusColor[s].bg} ${statusColor[s].text} border-transparent`
                            : "bg-card border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${statusColor[s].dot}`} />
                        {statusColor[s].label}
                      </button>
                    ))}
                  </div>
                  {plot.status === "available" && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">Clicking "Booked" or "Reserved" will open the Add Buyer form.</p>
                  )}
                  {plot.status === "booked" && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">Clicking "Reserved" will open the Record Payment form.</p>
                  )}
                </div>

                <Separator />

                {/* Status-aware primary actions */}
                {plot.status === "available" && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <UserPlus className="w-4 h-4 text-emerald-700" />
                      <div className="text-sm font-semibold text-emerald-900">This plot is vacant</div>
                    </div>
                    <p className="text-xs text-emerald-800 mb-3">
                      Add a buyer to start the booking process. Choose an existing customer or create a new one, then enter the advance amount.
                    </p>
                    <Button onClick={() => setDialogMode("addBuyer")} className="w-full bg-emerald-600 hover:bg-emerald-700" size="sm">
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Buyer
                    </Button>
                  </div>
                )}

                {(plot.status === "booked" || plot.status === "reserved") && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="w-4 h-4 text-amber-700" />
                      <div className="text-sm font-semibold text-amber-900">
                        {plot.status === "booked" ? "Booked — collect payment" : "Reserved — collect balance payment"}
                      </div>
                    </div>
                    <p className="text-xs text-amber-800 mb-3">
                      {plot.status === "booked"
                        ? `When total payments reach ${inr(RESERVE_THRESHOLD)}, this plot auto-upgrades to Reserved.`
                        : "Continue collecting payments until the balance is cleared."}
                    </p>
                    <Button onClick={() => setDialogMode("recordPayment")} className="w-full bg-amber-600 hover:bg-amber-700" size="sm">
                      <IndianRupee className="w-3.5 h-3.5 mr-1.5" /> Record Payment
                    </Button>
                  </div>
                )}

                {plot.status === "sold" && sale && outstanding > 0 && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-rose-700" />
                      <div className="text-sm font-semibold text-rose-900">Sold — pending balance</div>
                    </div>
                    <p className="text-xs text-rose-800 mb-3">Outstanding: <span className="font-semibold">{inr(outstanding)}</span></p>
                    <Button onClick={() => setDialogMode("recordPayment")} className="w-full bg-rose-600 hover:bg-rose-700" size="sm">
                      <IndianRupee className="w-3.5 h-3.5 mr-1.5" /> Record Final Payment
                    </Button>
                  </div>
                )}

                {/* Owner / Customer */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary" />
                    <div className="text-sm font-semibold">Owner Details</div>
                  </div>
                  {customer ? (
                    <div className="p-3 rounded-lg border border-border space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{customer.name}</div>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]"
                          onClick={() => { setRoute("customers"); onClose(); }}>View</Button>
                      </div>
                      {customer.referenceCode && (
                        <div className="text-[10px] font-mono text-primary bg-primary/5 inline-block px-1.5 py-0.5 rounded">{customer.referenceCode}</div>
                      )}
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" /> {customer.phone}</div>
                      {customer.email && <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" /> {customer.email}</div>}
                      {customer.pan && <div className="text-xs text-muted-foreground flex items-center gap-1.5"><IdCard className="w-3 h-3" /> PAN: {customer.pan}</div>}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                      No customer linked. Use <strong>Add Buyer</strong> to assign an owner.
                    </div>
                  )}
                </div>

                {/* Booking cancellation: NO banner is rendered. When a booking
                    was cancelled/taken back, plotBooking() returns undefined
                    (so Booking/Sale section is skipped) and plotPays is forced
                    to [] above (so Payment Summary shows "No payments recorded").
                    The panel simply shows the plot as available with empty
                    transaction history — per the user's instruction: "remove
                    previous booking when booking is taken back and show it
                    empty ... erase payment history in details panel". The
                    audit trail remains visible on the Payments page. */}

                {/* Booking / Sale */}
                {(booking || sale) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <div className="text-sm font-semibold">{sale ? "Sale Details" : "Booking Details"}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-border space-y-1.5 text-xs">
                      {(booking?.referenceCode || sale?.referenceCode) && (
                        <div className="pb-2 mb-1 border-b border-border">
                          <div className="text-[10px] uppercase text-muted-foreground">Reference Code</div>
                          <div className="font-mono font-semibold text-primary text-sm">{sale?.referenceCode ?? booking?.referenceCode}</div>
                        </div>
                      )}
                      {sale && (
                        <>
                          <Row label="Sale Date" value={formatDate(sale.saleDate)} />
                          <Row label="Registration #" value={sale.registrationNumber ?? "—"} />
                          <Row label="Sale Amount" value={inr(sale.saleAmount)} />
                          <Row label="Discount" value={inr(sale.discount)} />
                        </>
                      )}
                      {booking && !sale && (
                        <>
                          <Row label="Booking Date" value={formatDate(booking.bookingDate)} />
                          <Row label="Advance Paid" value={inr(booking.advancePaid)} />
                          <Row label="Discount" value={inr(booking.discount ?? 0)} />
                          <Row label="Payment Method" value={booking.paymentMethod.toUpperCase()} />
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment summary — only rendered when there's an active
                    booking or sale. When a booking was cancelled/taken back,
                    this entire section is hidden (no payment history, no
                    totals, no Record Payment button) per the user's
                    instruction to "erase payment history in details panel"
                    and "show it empty". */}
                {(booking || sale) && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    <div className="text-sm font-semibold">Payment Summary</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <div className="text-[10px] uppercase text-muted-foreground">Total</div>
                      <div className="text-xs font-semibold mt-0.5">{inr(plot.totalPrice)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 text-center">
                      <div className="text-[10px] uppercase opacity-80">Paid</div>
                      <div className="text-xs font-semibold mt-0.5">{inr(totalPaid)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-700 text-center">
                      <div className="text-[10px] uppercase opacity-80">Balance</div>
                      <div className="text-xs font-semibold mt-0.5">{inr(outstanding)}</div>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {plotPays.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground text-center py-2">No payments recorded</div>
                    ) : (
                      plotPays.map((p) => {
                        // Negative amounts are booking cancellations / take-backs.
                        const isReversal = p.amount < 0;
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between text-[11px] p-1.5 rounded ${isReversal ? "bg-rose-50 border border-rose-200" : "bg-muted/40"}`}
                          >
                            <div>
                              <div className="font-medium">{formatDate(p.date)}</div>
                              <div className={isReversal ? "text-rose-600" : "text-muted-foreground"}>
                                {p.paymentMode.toUpperCase()}
                                {p.remarks ? ` · ${p.remarks}` : ""}
                              </div>
                            </div>
                            <div className={`font-semibold ${isReversal ? "text-rose-700" : "text-emerald-700"}`}>
                              {inr(p.amount)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {(plot.status === "booked" || plot.status === "reserved" || (plot.status === "sold" && outstanding > 0)) && (
                    <Button variant="outline" size="sm" className="w-full mt-2 h-8 text-[11px]" onClick={() => setDialogMode("recordPayment")}>
                      <IndianRupee className="w-3 h-3 mr-1" /> Record Payment
                    </Button>
                  )}
                </div>
                )}

                {plot.notes && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileText className="w-4 h-4 text-primary" />
                      <div className="text-sm font-semibold">Remarks</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">{plot.notes}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 sticky bottom-0 bg-background pb-2">
                  <Button variant="outline" size="sm" className="h-9" onClick={startEdit}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit</Button>
                  <Button variant="outline" size="sm" className="h-9" onClick={handlePrint}><Printer className="w-3.5 h-3.5 mr-1.5" /> Print</Button>
                  <Button variant="outline" size="sm" className="h-9 col-span-2" onClick={() => setEmiOpen(true)}>
                    <Calculator className="w-3.5 h-3.5 mr-1.5" /> EMI Calculator
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 col-span-2 text-rose-600 hover:bg-rose-50" onClick={handleDelete}>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Plot
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Plot Number *</Label><Input value={form.plotNumber ?? ""} onChange={(e) => setForm((f) => ({ ...f, plotNumber: e.target.value }))} className="h-9" /></div>
                  <div><Label className="text-xs">Block</Label><Input value={form.block ?? ""} onChange={(e) => setForm((f) => ({ ...f, block: e.target.value }))} className="h-9" /></div>
                  <div><Label className="text-xs">Size</Label><NumberInput value={form.size ?? 0} onValueChange={(v) => setForm((f) => ({ ...f, size: v }))} allowDecimal className="h-9" /></div>
                  <div>
                    <Label className="text-xs">Size Unit</Label>
                    <Select value={form.sizeUnit ?? "cents"} onValueChange={(v) => setForm((f) => ({ ...f, sizeUnit: v as Plot["sizeUnit"] }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="cents">cents</SelectItem><SelectItem value="sqyd">sq yd</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Facing</Label>
                    <Select value={form.facing ?? "North"} onValueChange={(v) => setForm((f) => ({ ...f, facing: v as FacingDirection }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{allFacings.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Road Width (ft)</Label><NumberInput value={form.roadWidth ?? 0} onValueChange={(v) => setForm((f) => ({ ...f, roadWidth: v }))} className="h-9" /></div>
                  <div><Label className="text-xs">Price per {form.sizeUnit === "sqyd" ? "sq yd" : "Cent"}</Label><NumberInput value={form.pricePerCent ?? 0} onValueChange={(v) => setForm((f) => ({ ...f, pricePerCent: v }))} format className="h-9" /></div>
                  <div><Label className="text-xs">Total Price</Label><NumberInput value={form.totalPrice ?? 0} onValueChange={(v) => setForm((f) => ({ ...f, totalPrice: v }))} format className="h-9" /></div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={form.status ?? "available"} onValueChange={(v) => setForm((f) => ({ ...f, status: v as PlotStatus }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{allStatuses.map((s) => <SelectItem key={s} value={s}>{statusColor[s].label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md border border-border h-9 mt-5">
                    <Label className="text-xs">Corner Plot</Label>
                    <Switch checked={form.cornerPlot ?? false} onCheckedChange={(v) => setForm((f) => ({ ...f, cornerPlot: v }))} />
                  </div>
                  <div className="col-span-2"><Label className="text-xs">Notes / Remarks</Label><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 sticky bottom-0 bg-background pb-2">
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setEditMode(false)}><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
                  <Button variant="outline" size="sm" className="h-9 text-rose-600 hover:bg-rose-50" onClick={handleDelete}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
                  <Button size="sm" className="h-9 bg-primary" onClick={handleSave}><Save className="w-3.5 h-3.5 mr-1" /> Save</Button>
                </div>
              </>
            )}
 
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== In-page Add Buyer Dialog (no redirect) ===== */}
      {dialogMode === "addBuyer" && (
        <AddBuyerDialog
          plot={plot}
          project={project}
          layout={layout}
          customers={customers}
          onClose={() => setDialogMode(null)}
          onCustomerCreated={(customerId) => {
            // After customer creation/selection, the booking is already created inside the dialog
            setDialogMode(null);
            toast({ title: "Booking created", description: `Plot ${plot.plotNumber} is now booked` });
          }}
        />
      )}

      {/* ===== In-page Record Payment Dialog (no redirect) ===== */}
      {dialogMode === "recordPayment" && (
        <RecordPaymentDialog
          plot={plot}
          project={project}
          customer={customer}
          booking={booking}
          totalPaid={totalPaid}
          outstanding={outstanding}
          onClose={() => setDialogMode(null)}
          onRecorded={() => {
            setDialogMode(null);
            toast({ title: "Payment recorded", description: `Plot ${plot.plotNumber} updated` });
          }}
        />
      )}

      <EMICalculator
        open={emiOpen}
        onOpenChange={setEmiOpen}
        plot={plot}
        customer={customer}
        projectName={project?.name}
        company={settings}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// ============================================================
// AddBuyerDialog — in-page dialog for customer selection/creation + booking
// Renders on top of the Sheet (Dialog uses portal, z-index higher than Sheet)
// ============================================================
function AddBuyerDialog({
  plot, project, layout, customers, onClose, onCustomerCreated,
}: {
  plot: Plot;
  project: { name: string } | undefined;
  layout: { name: string } | undefined;
  customers: Customer[];
  onClose: () => void;
  onCustomerCreated: (customerId: string) => void;
}) {
  const { addCustomer, addBooking } = useCrm();
  const { toast } = useToast();

  const [step, setStep] = useState<"customer" | "booking">("customer");
  const [buyerMode, setBuyerMode] = useState<"new" | "existing">("new");
  const [existingCustomerId, setExistingCustomerId] = useState("");
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New customer form
  const [custForm, setCustForm] = useState({
    name: "", phone: "", email: "", alternatePhone: "",
    address: "", city: "", state: "", pinCode: "",
    fatherName: "", motherName: "", occupation: "", pan: "", aadhaar: "",
  });

  // Booking form
  const [bookingForm, setBookingForm] = useState({
    advancePaid: Math.round(plot.totalPrice * 0.1),
    discount: 0,
    paymentMethod: "cheque" as PaymentMode,
    bookingDate: new Date().toISOString().slice(0, 10),
    bookingExpiry: "",
    remarks: "",
  });

  const handleNextFromCustomer = () => {
    if (buyerMode === "existing") {
      if (!existingCustomerId) { toast({ title: "Select a customer", variant: "destructive" }); return; }
      setCreatedCustomerId(existingCustomerId);
    } else {
      if (!custForm.name.trim()) { toast({ title: "Customer name is required", variant: "destructive" }); return; }
      if (!custForm.phone.trim()) { toast({ title: "Phone number is required", variant: "destructive" }); return; }
      const newId = addCustomer({ ...custForm, photo: "", remarks: "" });
      setCreatedCustomerId(newId);
    }
    setStep("booking");
  };

  const handleCreateBooking = () => {
    if (!createdCustomerId) return;
    if (bookingForm.advancePaid <= 0) { toast({ title: "Enter a valid advance amount", variant: "destructive" }); return; }
    setSaving(true);
    addBooking({
      plotId: plot.id,
      customerId: createdCustomerId,
      bookingDate: new Date(bookingForm.bookingDate).toISOString(),
      advancePaid: bookingForm.advancePaid,
      discount: bookingForm.discount,
      paymentMethod: bookingForm.paymentMethod,
      expectedRegistrationDate: undefined,
      bookingExpiry: bookingForm.bookingExpiry ? new Date(bookingForm.bookingExpiry).toISOString() : undefined,
      status: "active",
      remarks: bookingForm.remarks,
    });
    setSaving(false);
    onCustomerCreated(createdCustomerId);
  };

  const activeCustomer = createdCustomerId ? customers.find((c) => c.id === createdCustomerId) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {step === "customer" ? "Add New Buyer" : "New Booking"}
          </DialogTitle>
          <DialogDescription>
            {step === "customer"
              ? `Plot ${plot.plotNumber} · ${project?.name ?? ""} · ${inr(plot.totalPrice)}`
              : `Plot ${plot.plotNumber} · Buyer: ${activeCustomer?.name ?? "—"}`
            }
          </DialogDescription>
        </DialogHeader>

        {step === "customer" ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Plot summary */}
            <div className="p-3 rounded-md bg-muted/50 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-muted-foreground">Plot:</span> <span className="font-medium">{plot.plotNumber}</span></div>
                <div><span className="text-muted-foreground">Block:</span> <span className="font-medium">{plot.block}</span></div>
                <div><span className="text-muted-foreground">Size:</span> <span className="font-medium">{plot.size} {plot.sizeUnit}</span></div>
                <div><span className="text-muted-foreground">Facing:</span> <span className="font-medium">{plot.facing}</span></div>
                <div><span className="text-muted-foreground">Price:</span> <span className="font-medium">{inr(plot.totalPrice)}</span></div>
                <div><span className="text-muted-foreground">Project:</span> <span className="font-medium">{project?.name ?? "—"}</span></div>
              </div>
            </div>

            {/* Tab toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button onClick={() => setBuyerMode("new")} className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium ${buyerMode === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Create New Customer</button>
              <button onClick={() => setBuyerMode("existing")} className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium ${buyerMode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Choose Existing</button>
            </div>

            {buyerMode === "existing" ? (
              <div className="space-y-3">
                <Label className="text-xs">Select Customer *</Label>
                <Select value={existingCustomerId} onValueChange={setExistingCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Choose a customer..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}{c.referenceCode ? ` (${c.referenceCode})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {existingCustomerId && (
                  <div className="p-2.5 rounded-md bg-muted/50 text-xs">
                    {(() => { const c = customers.find((x) => x.id === existingCustomerId); return c ? (
                      <div><div className="font-medium">{c.name}</div><div className="text-muted-foreground">{c.phone} · {c.city ?? ""}</div></div>
                    ) : null; })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Full Name *</Label><Input value={custForm.name} onChange={(e) => setCustForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div><Label className="text-xs">Phone *</Label><Input value={custForm.phone} onChange={(e) => setCustForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91..." /></div>
                <div><Label className="text-xs">Email</Label><Input type="email" value={custForm.email} onChange={(e) => setCustForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div><Label className="text-xs">Alt Phone</Label><Input value={custForm.alternatePhone} onChange={(e) => setCustForm((f) => ({ ...f, alternatePhone: e.target.value }))} /></div>
                <div className="col-span-2"><Label className="text-xs">Address</Label><Input value={custForm.address} onChange={(e) => setCustForm((f) => ({ ...f, address: e.target.value }))} /></div>
                <div><Label className="text-xs">City</Label><Input value={custForm.city} onChange={(e) => setCustForm((f) => ({ ...f, city: e.target.value }))} /></div>
                <div><Label className="text-xs">State</Label><Input value={custForm.state} onChange={(e) => setCustForm((f) => ({ ...f, state: e.target.value }))} /></div>
                <div><Label className="text-xs">PAN</Label><Input value={custForm.pan} onChange={(e) => setCustForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" /></div>
                <div><Label className="text-xs">Occupation</Label><Input value={custForm.occupation} onChange={(e) => setCustForm((f) => ({ ...f, occupation: e.target.value }))} /></div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Prefilled summary */}
            <div className="p-3 rounded-md bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Plot:</span><span className="font-medium">{plot.plotNumber} · Block {plot.block} · {plot.size} {plot.sizeUnit}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Project:</span><span className="font-medium">{project?.name ?? "—"} · {layout?.name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Buyer:</span><span className="font-medium">{activeCustomer?.name ?? "—"} · {activeCustomer?.phone ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Price:</span><span className="font-bold">{inr(plot.totalPrice)}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Advance Paid (₹) *</Label>
                <NumberInput value={bookingForm.advancePaid} onValueChange={(v) => setBookingForm((f) => ({ ...f, advancePaid: v }))} format className="h-9" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {bookingForm.advancePaid >= RESERVE_THRESHOLD ? "≥ ₹50,000 → Plot will be Reserved" : "< ₹50,000 → Plot will be Booked"}
                </p>
              </div>
              <div>
                <Label className="text-xs">Discount (₹)</Label>
                <NumberInput value={bookingForm.discount} onValueChange={(v) => setBookingForm((f) => ({ ...f, discount: v }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Booking Date</Label>
                <Input type="date" value={bookingForm.bookingDate} onChange={(e) => setBookingForm((f) => ({ ...f, bookingDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={bookingForm.paymentMethod} onValueChange={(v) => setBookingForm((f) => ({ ...f, paymentMethod: v as PaymentMode }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{allPaymentModes.map((m) => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Booking Expiry</Label>
                <Input type="date" value={bookingForm.bookingExpiry} onChange={(e) => setBookingForm((f) => ({ ...f, bookingExpiry: e.target.value }))} />
              </div>
              <div className="col-span-2"><Label className="text-xs">Remarks</Label><Textarea rows={2} value={bookingForm.remarks} onChange={(e) => setBookingForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "customer" ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleNextFromCustomer} className="bg-primary">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("customer")}>Back</Button>
              <Button onClick={handleCreateBooking} className="bg-primary" disabled={saving}>
                {saving ? "Creating..." : "Create Booking"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// RecordPaymentDialog — in-page dialog for recording a payment
// ============================================================
function RecordPaymentDialog({
  plot, project, customer, booking, totalPaid, outstanding, onClose, onRecorded,
}: {
  plot: Plot;
  project: { name: string } | undefined;
  customer: Customer | undefined;
  booking: { id: string; referenceCode?: string } | undefined;
  totalPaid: number;
  outstanding: number;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const { addPayment } = useCrm();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("rtgs");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const handleSave = () => {
    if (amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setSaving(true);
    addPayment({
      plotId: plot.id,
      customerId: customer?.id,
      bookingId: booking?.id,
      date: new Date(date).toISOString(),
      amount,
      paymentMode,
      referenceNumber: referenceNumber || undefined,
      remarks: remarks || undefined,
    });
    setSaving(false);
    onRecorded();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Plot {plot.plotNumber} · {project?.name ?? ""}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Prefilled summary */}
          <div className="p-3 rounded-md bg-muted/50 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Plot:</span><span className="font-medium">{plot.plotNumber} · Block {plot.block} · {plot.size} {plot.sizeUnit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span><span className="font-medium">{customer?.name ?? "—"} · {customer?.phone ?? "—"}</span></div>
            {booking?.referenceCode && <div className="flex justify-between"><span className="text-muted-foreground">Booking Ref:</span><span className="font-mono text-primary">{booking.referenceCode}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Total Price:</span><span className="font-medium">{inr(plot.totalPrice)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Already Paid:</span><span className="font-medium text-emerald-700">{inr(totalPaid)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Outstanding:</span><span className="font-medium text-rose-700">{inr(outstanding)}</span></div>
          </div>

          {/* Amount — primary field */}
          <div>
            <Label className="text-xs font-semibold text-primary">Payment Amount (₹) *</Label>
            <NumberInput value={amount} onValueChange={setAmount} format className="h-11 text-lg ring-2 ring-primary/40 border-primary" autoFocus />
            <p className="text-[10px] text-muted-foreground mt-1">Primary field — enter the amount received.</p>
            {amount > 0 && (totalPaid + amount) >= RESERVE_THRESHOLD && plot.status === "booked" && (
              <p className="text-[10px] text-amber-700 mt-1">After this payment, total ≥ ₹50,000 → Plot will auto-upgrade to Reserved.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as PaymentMode)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{allPaymentModes.map((m) => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs">Reference Number (optional)</Label><Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">Remarks (optional)</Label><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-primary" disabled={saving}>
            {saving ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



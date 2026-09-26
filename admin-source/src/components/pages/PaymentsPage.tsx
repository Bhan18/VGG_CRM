
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
import { Plus, Pencil, Trash2, Wallet, IndianRupee, Printer, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { formatDate, inr, inrCompact, allPaymentModes, printPaymentReceipt, totalPaidForPlot, outstandingForPlot } from "@/lib/format";
import type { Payment, PaymentMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import type { Permissions } from "@/lib/permissions";

interface FormState {
  plotId: string;
  customerId: string;
  date: string;
  amount: number;
  paymentMode: PaymentMode;
  referenceNumber: string;
  bank: string;
  chequeNumber: string;
  transactionId: string;
  remarks: string;
}

const blank: FormState = {
  plotId: "",
  customerId: "",
  date: new Date().toISOString().slice(0, 10),
  amount: 0,
  paymentMode: "rtgs",
  referenceNumber: "",
  bank: "",
  chequeNumber: "",
  transactionId: "",
  remarks: "",
};

export default function PaymentsPage({ permissions }: { permissions?: Permissions }) {
  const { payments, plots, customers, sales, bookings, projects, settings, addPayment, updatePayment, deletePayment, setRoute, prefillPayment, clearPrefill } = useCrm();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<PaymentMode | "all">("all");
  // True when the dialog was opened via the "Record Payment" prefill flow from a plot
  const [isPrefilled, setIsPrefilled] = useState(false);

  const sortedPayments = useMemo(
    () =>
      [...payments]
        .filter((p) => filterMode === "all" || p.paymentMode === filterMode)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [payments, filterMode],
  );

  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
  const totalOutstanding = plots
    .filter((p) => p.status === "sold" || p.status === "booked" || p.status === "reserved")
    .reduce((sum, p) => sum + outstandingForPlot(p, payments), 0);

  const openAdd = (presetPlotId?: string, presetCustomerId?: string) => {
    setEditingId(null);
    const f = { ...blank };
    if (presetPlotId) f.plotId = presetPlotId;
    if (presetCustomerId) f.customerId = presetCustomerId;
    setForm(f);
    setIsPrefilled(false);
    setDialogOpen(true);
  };

  const openEdit = (p: Payment) => {
    setEditingId(p.id);
    setForm({
      plotId: p.plotId ?? "",
      customerId: p.customerId ?? "",
      date: p.date.slice(0, 10),
      amount: p.amount,
      paymentMode: p.paymentMode,
      referenceNumber: p.referenceNumber ?? "",
      bank: p.bank ?? "",
      chequeNumber: p.chequeNumber ?? "",
      transactionId: p.transactionId ?? "",
      remarks: p.remarks ?? "",
    });
    setIsPrefilled(false);
    setDialogOpen(true);
  };

  // Auto-open the payment dialog when arriving via the "Record Payment" flow from a plot
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prefillPayment) {
      const { plotId, customerId } = prefillPayment;
      setEditingId(null);
      setForm({
        ...blank,
        plotId,
        customerId: customerId ?? "",
      });
      setIsPrefilled(true);
      setDialogOpen(true);
      clearPrefill();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [prefillPayment, clearPrefill]);

  const handleSave = () => {
    if (form.amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      plotId: form.plotId || undefined,
      customerId: form.customerId || undefined,
      date: new Date(form.date).toISOString(),
    };
    if (editingId) {
      updatePayment(editingId, payload);
      toast({ title: "Payment updated" });
    } else {
      addPayment(payload);
      toast({ title: "Payment recorded", description: inr(form.amount) });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deletePayment(deleteId);
    toast({ title: "Payment deleted", variant: "destructive" });
    setDeleteId(null);
  };

  const handlePrint = (p: Payment) => {
    const plot = plots.find((x) => x.id === p.plotId);
    const cust = customers.find((c) => c.id === p.customerId);
    const booking = bookings.find((b) => b.id === plot?.bookingId);
    const sale = sales.find((s) => s.id === plot?.saleId);
    const projectName = plot ? projects.find((pr) => pr.id === plot.projectId)?.name : undefined;
    const totalPaid = plot ? totalPaidForPlot(plot, payments) : undefined;
    const outstanding = plot ? outstandingForPlot(plot, payments, bookings, sales) : undefined;

    printPaymentReceipt({
      payment: p,
      plot,
      customer: cust,
      booking,
      sale,
      company: settings,
      projectName,
      totalPaidToDate: totalPaid,
      outstandingAfterPayment: outstanding,
    });
  };

  const columns: DataTableColumn<Payment>[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (p) => p.date,
      render: (p) => <span className="text-xs">{formatDate(p.date)}</span>,
    },
    {
      key: "ref",
      header: "Reference",
      render: (p) => (
        <div>
          <div className="font-mono text-xs font-semibold">{p.referenceNumber ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">{p.transactionId ?? p.chequeNumber ?? ""}</div>
        </div>
      ),
    },
    {
      key: "plot",
      header: "Plot",
      sortable: true,
      sortValue: (p) => plots.find((x) => x.id === p.plotId)?.plotNumber ?? "",
      render: (p) => {
        const plot = plots.find((x) => x.id === p.plotId);
        return plot ? (
          <button
            onClick={() =>
              setRoute("interactive-layout", {
                selectedProjectId: plot.projectId,
                selectedLayoutId: plot.layoutId,
                selectedPlotId: plot.id,
              })
            }
            className="text-sm font-medium text-primary hover:underline"
          >
            {plot.plotNumber}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (p) => customers.find((c) => c.id === p.customerId)?.name ?? "",
      render: (p) => {
        const c = customers.find((c) => c.id === p.customerId);
        return c ? <span className="text-sm">{c.name}</span> : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      key: "mode",
      header: "Mode",
      render: (p) => (
        <Badge variant="outline" className="text-[10px] capitalize">
          {p.paymentMode.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "bank",
      header: "Bank",
      render: (p) => <span className="text-xs text-muted-foreground">{p.bank ?? "—"}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (p) => p.amount,
      render: (p) => {
        // Negative amounts represent booking cancellations / take-backs —
        // render them in red so finance can spot reversals at a glance.
        const isReversal = p.amount < 0;
        return (
          <div className={`flex items-center gap-1.5 ${isReversal ? "text-rose-700" : "text-emerald-700"}`}>
            {isReversal && <TrendingDown className="w-3.5 h-3.5" />}
            <span className="font-semibold text-sm">{inr(p.amount)}</span>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (p) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePrint(p)}>
            <Printer className="w-3.5 h-3.5" />
          </Button>
          {permissions?.canRecordPayments !== false && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(p)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {permissions?.canDeleteData && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
              onClick={() => setDeleteId(p.id)}
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
        title="Payments"
        description="Track every payment receipt. Outstanding balances are computed automatically from plot price and total paid."
        actions={
          permissions?.canRecordPayments !== false ? (
            <Button onClick={() => openAdd()} className="bg-primary">
              <Plus className="w-4 h-4 mr-1.5" /> Record Payment
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Receipts</div>
          <div className="text-xl font-bold mt-1">{payments.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Collected</div>
          <div className="text-xl font-bold mt-1 text-emerald-700">{inrCompact(totalCollected)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Outstanding</div>
          <div className="text-xl font-bold mt-1 text-rose-700">{inrCompact(totalOutstanding)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg Receipt</div>
          <div className="text-xl font-bold mt-1">
            {inrCompact(payments.length > 0 ? totalCollected / payments.length : 0)}
          </div>
        </Card>
      </div>

      <DataTable
        title="Payment History"
        columns={columns}
        rows={sortedPayments}
        searchPlaceholder="Search by ref #, plot, customer..."
        searchKeys={[
          (p) => p.referenceNumber ?? "",
          (p) => p.transactionId ?? "",
          (p) => p.chequeNumber ?? "",
          (p) => plots.find((x) => x.id === p.plotId)?.plotNumber ?? "",
          (p) => customers.find((c) => c.id === p.customerId)?.name ?? "",
        ]}
        exportFilename="vgg-payments"
        pageSize={10}
        onRowClick={(p) => openEdit(p)}
        permissions={permissions ? { canExport: permissions.canExport } : undefined}
        toolbar={
          <>
            <span className="text-xs text-muted-foreground mr-1">Mode:</span>
            <Select value={filterMode} onValueChange={(v) => setFilterMode(v as PaymentMode | "all")}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                {allPaymentModes.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setIsPrefilled(false); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isPrefilled ? "Record Payment (Prefilled)" : editingId ? "Edit Payment" : "Record New Payment"}</DialogTitle>
            <DialogDescription>
              {isPrefilled
                ? "Plot and customer are prefilled. Enter the payment amount below — the plot status will update automatically based on total payments received."
                : "Capture full payment details — mode, reference, bank, cheque/transaction info."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {/* Prefilled read-only summary */}
            {isPrefilled && (() => {
              const plot = plots.find((p) => p.id === form.plotId);
              const project = projects.find((p) => p.id === plot?.projectId);
              const cust = customers.find((c) => c.id === form.customerId);
              if (!plot) return null;
              const paid = totalPaidForPlot(plot, payments);
              const outstanding = outstandingForPlot(plot, payments);
              return (
                <div className="p-3 rounded-md border border-primary/30 bg-primary/5 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-primary text-sm">
                    <Wallet className="w-4 h-4" />
                    Prefilled Plot & Customer
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div><span className="text-muted-foreground">Plot:</span> <span className="font-medium">{plot.plotNumber}</span></div>
                    <div><span className="text-muted-foreground">Project:</span> <span className="font-medium">{project?.name ?? "—"}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{cust?.name ?? "—"}{cust?.phone ? ` · ${cust.phone}` : ""}</span></div>
                    <div><span className="text-muted-foreground">Total Price:</span> <span className="font-medium">{inr(plot.totalPrice)}</span></div>
                    <div><span className="text-muted-foreground">Already Paid:</span> <span className="font-semibold text-emerald-700">{inr(paid)}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Balance:</span> <span className="font-semibold text-rose-700">{inr(outstanding)}</span></div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Plot</Label>
                <Select value={form.plotId} onValueChange={(v) => setForm((f) => ({ ...f, plotId: v }))} disabled={isPrefilled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plot (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {plots.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.plotNumber} · {p.block}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Customer</Label>
                <Select value={form.customerId} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))} disabled={isPrefilled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Plot summary if selected (not in prefill mode — prefill has its own summary above) */}
            {form.plotId && !isPrefilled && (() => {
              const plot = plots.find((p) => p.id === form.plotId);
              if (!plot) return null;
              const paid = totalPaidForPlot(plot, payments.filter((p) => p.id !== editingId));
              const outstanding = outstandingForPlot(plot, payments.filter((p) => p.id !== editingId));
              return (
                <div className="p-2.5 rounded-md bg-muted/50 text-xs grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-muted-foreground">Total Price</div>
                    <div className="font-semibold">{inr(plot.totalPrice)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Already Paid</div>
                    <div className="font-semibold text-emerald-700">{inr(paid)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Balance</div>
                    <div className="font-semibold text-rose-700">{inr(outstanding)}</div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label className={`text-xs ${isPrefilled ? "font-semibold text-primary" : ""}`}>Amount *</Label>
                <NumberInput
                  value={form.amount}
                  onValueChange={(v) => setForm((f) => ({ ...f, amount: v }))}
                  format
                  autoFocus={isPrefilled}
                  className={isPrefilled ? "ring-2 ring-primary/40 border-primary" : ""}
                />
                {isPrefilled && (
                  <div className="text-[10px] text-primary mt-1">Primary field — enter the amount received.</div>
                )}
              </div>
              <div>
                <Label className="text-xs">Payment Mode</Label>
                <Select value={form.paymentMode} onValueChange={(v) => setForm((f) => ({ ...f, paymentMode: v as PaymentMode }))}>
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
                <Label className="text-xs">Reference Number</Label>
                <Input value={form.referenceNumber} onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Bank</Label>
                <Input value={form.bank} onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))} placeholder="HDFC Bank" />
              </div>
              <div>
                <Label className="text-xs">Cheque Number</Label>
                <Input value={form.chequeNumber} onChange={(e) => setForm((f) => ({ ...f, chequeNumber: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Transaction ID (UTR)</Label>
                <Input value={form.transactionId} onChange={(e) => setForm((f) => ({ ...f, transactionId: e.target.value }))} />
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
              {editingId ? "Save Changes" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              Outstanding balances will be recalculated automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



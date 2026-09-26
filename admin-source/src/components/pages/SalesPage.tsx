
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
import { Plus, Pencil, Trash2, Banknote, Printer, FileText, Calculator } from "lucide-react";
import { useState, useMemo } from "react";
import { formatDate, inr, inrCompact, allPaymentModes, printHTML } from "@/lib/format";
import type { Sale, PaymentMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { EMICalculator } from "@/components/shared/EMICalculator";
import type { Permissions } from "@/lib/permissions";

interface FormState {
  plotId: string;
  customerId: string;
  saleDate: string;
  registrationNumber: string;
  saleAmount: number;
  discount: number;
  registrationOffice: string;
  executiveName: string;
  paymentMethod: PaymentMode;
  balanceAmount: number;
  remarks: string;
}

const blank: FormState = {
  plotId: "",
  customerId: "",
  saleDate: new Date().toISOString().slice(0, 10),
  registrationNumber: "",
  saleAmount: 0,
  discount: 0,
  registrationOffice: "",
  executiveName: "",
  paymentMethod: "rtgs",
  balanceAmount: 0,
  remarks: "",
};

export default function SalesPage({ permissions }: { permissions?: Permissions }) {
  const { sales, plots, customers, projects, layouts, bookings, addSale, updateSale, deleteSale, setRoute, settings } = useCrm();
  const { toast } = useToast();
  const [emiOpen, setEmiOpen] = useState(false);
  const [emiPlotId, setEmiPlotId] = useState<string | undefined>(undefined);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sortedSales = useMemo(
    () => [...sales].sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()),
    [sales],
  );

  // Plots eligible for sale: not already sold and not blocked
  const sellablePlots = plots.filter((p) => p.status !== "sold" && p.status !== "blocked");

  const openAdd = (presetPlotId?: string) => {
    setEditingId(null);
    const f = { ...blank };
    if (presetPlotId) {
      f.plotId = presetPlotId;
      const plot = plots.find((p) => p.id === presetPlotId);
      if (plot) {
        f.saleAmount = plot.totalPrice;
        if (plot.customerId) f.customerId = plot.customerId;
        // Auto-carry discount from booking (if any) so it's not forgotten at sale time
        if (plot.bookingId) {
          const booking = bookings.find((b) => b.id === plot.bookingId);
          if (booking && booking.discount) {
            f.discount = booking.discount;
          }
        }
      }
    }
    setForm(f);
    setDialogOpen(true);
  };

  const openEdit = (s: Sale) => {
    setEditingId(s.id);
    setForm({
      plotId: s.plotId,
      customerId: s.customerId,
      saleDate: s.saleDate.slice(0, 10),
      registrationNumber: s.registrationNumber ?? "",
      saleAmount: s.saleAmount,
      discount: s.discount,
      registrationOffice: s.registrationOffice ?? "",
      executiveName: s.executiveName ?? "",
      paymentMethod: s.paymentMethod,
      balanceAmount: s.balanceAmount,
      remarks: s.remarks ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.plotId) {
      toast({ title: "Select a plot", variant: "destructive" });
      return;
    }
    if (!form.customerId) {
      toast({ title: "Select a customer", variant: "destructive" });
      return;
    }
    if (form.saleAmount <= 0) {
      toast({ title: "Enter sale amount", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      saleDate: new Date(form.saleDate).toISOString(),
    };
    if (editingId) {
      updateSale(editingId, payload);
      toast({ title: "Sale updated" });
    } else {
      addSale(payload);
      toast({ title: "Sale recorded", description: "Plot status updated to Sold" });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteSale(deleteId);
    toast({ title: "Sale deleted", variant: "destructive" });
    setDeleteId(null);
  };

  const handlePrint = (s: Sale) => {
    const plot = plots.find((p) => p.id === s.plotId);
    const cust = customers.find((c) => c.id === s.customerId);
    const proj = projects.find((p) => p.id === plot?.projectId);
    const body = `
      <h2>Sale Receipt</h2>
      <div style="color:#64748b;margin-bottom:16px">Registration # ${s.registrationNumber ?? "—"} · ${formatDate(s.saleDate)}</div>
      <table>
        <tr><th>Project</th><td>${proj?.name ?? ""}</td></tr>
        <tr><th>Plot</th><td>${plot?.plotNumber ?? ""} (Block ${plot?.block})</td></tr>
        <tr><th>Size</th><td>${plot?.size} ${plot?.sizeUnit}</td></tr>
        <tr><th>Buyer</th><td>${cust?.name ?? ""}</td></tr>
        <tr><th>Buyer Phone</th><td>${cust?.phone ?? ""}</td></tr>
        <tr><th>Sale Amount</th><td>${inr(s.saleAmount)}</td></tr>
        <tr><th>Discount</th><td>${inr(s.discount)}</td></tr>
        <tr><th>Net Amount</th><td>${inr(s.saleAmount - s.discount)}</td></tr>
        <tr><th>Balance</th><td>${inr(s.balanceAmount)}</td></tr>
        <tr><th>Registration Office</th><td>${s.registrationOffice ?? "—"}</td></tr>
        <tr><th>Executive</th><td>${s.executiveName ?? "—"}</td></tr>
        <tr><th>Payment Method</th><td>${s.paymentMethod.toUpperCase()}</td></tr>
      </table>
    `;
    printHTML(`Sale Receipt - ${plot?.plotNumber ?? ""}`, body);
  };

  const openEMI = (s: Sale) => {
    setEmiPlotId(s.plotId);
    setEmiOpen(true);
  };

  const columns: DataTableColumn<Sale>[] = [
    {
      key: "ref",
      header: "Reference Code",
      sortable: true,
      sortValue: (s) => s.referenceCode ?? "",
      render: (s) => (
        <div>
          <div className="font-mono text-[11px] font-semibold text-primary">{s.referenceCode ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground">{s.registrationNumber ?? ""}</div>
        </div>
      ),
    },
    {
      key: "plot",
      header: "Plot",
      sortable: true,
      sortValue: (s) => plots.find((p) => p.id === s.plotId)?.plotNumber ?? "",
      render: (s) => {
        const plot = plots.find((p) => p.id === s.plotId);
        const proj = projects.find((p) => p.id === plot?.projectId);
        return (
          <div>
            <div className="font-medium text-sm">{plot?.plotNumber ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">{proj?.name}</div>
          </div>
        );
      },
    },
    {
      key: "buyer",
      header: "Buyer",
      sortable: true,
      sortValue: (s) => customers.find((c) => c.id === s.customerId)?.name ?? "",
      render: (s) => {
        const c = customers.find((c) => c.id === s.customerId);
        return (
          <div>
            <div className="font-medium text-sm">{c?.name ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">{c?.phone}</div>
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Sale Amount",
      sortable: true,
      sortValue: (s) => s.saleAmount,
      render: (s) => (
        <div className="text-right">
          <div className="font-semibold text-sm">{inr(s.saleAmount)}</div>
          {s.discount > 0 && <div className="text-[11px] text-muted-foreground">disc: {inr(s.discount)}</div>}
        </div>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      sortable: true,
      sortValue: (s) => s.balanceAmount,
      render: (s) => (
        <Badge
          variant="outline"
          className={`text-[10px] ${
            s.balanceAmount > 0
              ? "bg-rose-50 text-rose-700 border-transparent"
              : "bg-emerald-50 text-emerald-700 border-transparent"
          }`}
        >
          {inr(s.balanceAmount)}
        </Badge>
      ),
    },
    {
      key: "office",
      header: "Reg. Office",
      render: (s) => <span className="text-xs">{s.registrationOffice ?? "—"}</span>,
    },
    {
      key: "exec",
      header: "Executive",
      render: (s) => <span className="text-xs">{s.executiveName ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (s) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePrint(s)} title="Print receipt">
            <Printer className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEMI(s)} title="EMI calculator">
            <Calculator className="w-3.5 h-3.5" />
          </Button>
          {permissions?.canCreateSales !== false && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(s)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {permissions?.canDeleteData && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
              onClick={() => setDeleteId(s.id)}
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
        title="Sales"
        description="Record plot sales with registration details. A new sale automatically changes the plot status to Sold."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setEmiPlotId(undefined); setEmiOpen(true); }}>
              <Calculator className="w-4 h-4 mr-1.5" /> EMI Calculator
            </Button>
            {permissions?.canCreateSales !== false ? (
              <Button onClick={() => openAdd()} className="bg-primary">
                <Plus className="w-4 h-4 mr-1.5" /> New Sale
              </Button>
            ) : undefined}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Sales</div>
          <div className="text-xl font-bold mt-1">{sales.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Value</div>
          <div className="text-xl font-bold mt-1 text-rose-700">
            {inrCompact(sales.reduce((s, x) => s + x.saleAmount, 0))}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Discounts Given</div>
          <div className="text-xl font-bold mt-1 text-amber-700">
            {inrCompact(sales.reduce((s, x) => s + x.discount, 0))}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Balance to Collect</div>
          <div className="text-xl font-bold mt-1 text-rose-700">
            {inrCompact(sales.reduce((s, x) => s + x.balanceAmount, 0))}
          </div>
        </Card>
      </div>

      <DataTable
        title="All Sales"
        columns={columns}
        rows={sortedSales}
        searchPlaceholder="Search by reg #, plot, buyer..."
        searchKeys={[
          (s) => s.registrationNumber ?? "",
          (s) => plots.find((p) => p.id === s.plotId)?.plotNumber ?? "",
          (s) => customers.find((c) => c.id === s.customerId)?.name ?? "",
        ]}
        exportFilename="vgg-sales"
        pageSize={10}
        onRowClick={(s) => openEdit(s)}
        permissions={permissions ? { canExport: permissions.canExport } : undefined}
      />

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Sale" : "Record New Sale"}</DialogTitle>
            <DialogDescription>
              A new sale automatically marks the plot as Sold and links it to the buyer.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Plot *</Label>
                <Select
                  value={form.plotId}
                  onValueChange={(v) => {
                    const plot = plots.find((p) => p.id === v);
                    setForm((f) => ({
                      ...f,
                      plotId: v,
                      saleAmount: plot?.totalPrice ?? f.saleAmount,
                      customerId: plot?.customerId ?? f.customerId,
                    }));
                  }}
                  disabled={!!editingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plot" />
                  </SelectTrigger>
                  <SelectContent>
                    {(editingId ? plots : sellablePlots).map((p) => {
                      const proj = projects.find((x) => x.id === p.projectId);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {p.plotNumber} · {proj?.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Buyer *</Label>
                <Select value={form.customerId} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select buyer" />
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sale Date *</Label>
                <Input type="date" value={form.saleDate} onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Registration Number</Label>
                <Input
                  value={form.registrationNumber}
                  onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                  placeholder="KA-REG-00001"
                />
              </div>
              <div>
                <Label className="text-xs">Sale Amount *</Label>
                <NumberInput
                  value={form.saleAmount}
                  onValueChange={(v) => setForm((f) => ({ ...f, saleAmount: v }))}
                  format
                />
              </div>
              <div>
                <Label className="text-xs">Discount</Label>
                <NumberInput
                  value={form.discount}
                  onValueChange={(v) => setForm((f) => ({ ...f, discount: v }))}
                  format
                />
              </div>
              <div>
                <Label className="text-xs">Balance Amount</Label>
                <NumberInput
                  value={form.balanceAmount}
                  onValueChange={(v) => setForm((f) => ({ ...f, balanceAmount: v }))}
                  format
                />
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v as PaymentMode }))}>
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
                <Label className="text-xs">Registration Office</Label>
                <Input value={form.registrationOffice} onChange={(e) => setForm((f) => ({ ...f, registrationOffice: e.target.value }))} placeholder="Sub-Registrar Office" />
              </div>
              <div>
                <Label className="text-xs">Executive Name</Label>
                <Input value={form.executiveName} onChange={(e) => setForm((f) => ({ ...f, executiveName: e.target.value }))} />
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
              {editingId ? "Save Changes" : "Record Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sale record?</AlertDialogTitle>
            <AlertDialogDescription>
              The plot will become available again. This action cannot be undone.
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

      <EMICalculator
        open={emiOpen}
        onOpenChange={setEmiOpen}
        plot={emiPlotId ? plots.find((p) => p.id === emiPlotId) : undefined}
        customer={emiPlotId ? customers.find((c) => c.id === plots.find((p) => p.id === emiPlotId)?.customerId) : undefined}
        projectName={emiPlotId ? projects.find((p) => p.id === plots.find((x) => x.id === emiPlotId)?.projectId)?.name : undefined}
        company={settings}
      />
    </div>
  );
}



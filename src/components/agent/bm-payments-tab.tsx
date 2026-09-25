"use client";

// Branch-manager Payments tab (staff app) — record payments against booked
// plots with up to 3 proof photos, and track own recordings through
// approval. Everything recorded here enters as `pending`; the ledger
// updates only after admin approval on the website.

import { useEffect, useState } from "react";
import {
  IndianRupee,
  Plus,
  Loader2,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  ImageIcon,
  ChevronLeft,
  Wallet,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import {
  useBmCustomers,
  useBmPayments,
  useRecordBmPayment,
  type BmCustomer,
  type BmPlotOption,
  type BmRecording,
} from "@/hooks/agent/use-agent-data";
import { Skeleton } from "@/components/ui/skeleton";

const MODES = ["cash", "upi", "rtgs", "neft", "imps", "cheque", "card", "bank_transfer"];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending approval", color: "#b45309", bg: "color-mix(in srgb, #d97706 10%, white)" },
  approved: { label: "Approved", color: "var(--brand-emerald)", bg: "color-mix(in srgb, var(--brand-emerald) 10%, white)" },
  rejected: { label: "Rejected", color: "var(--brand-checkout)", bg: "color-mix(in srgb, var(--brand-checkout) 8%, white)" },
};

const inputCls =
  "rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]";

export function BmPaymentsTab() {
  const customersQ = useBmCustomers(true);
  const paysQ = useBmPayments(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = paysQ.data ?? [];
  const pending = items.filter((p) => p.status === "pending");
  const approved = items.filter((p) => p.status === "approved");
  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0);
  const selected = items.find((p) => p.id === selectedId) ?? null;

  return (
    <section className="space-y-4 px-4 pb-6 pt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          <h2 className="text-sm font-semibold">Payments</h2>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="agent-press flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--brand-emerald)" }}
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <><Plus className="h-3.5 w-3.5" /> Record</>}
          {showForm ? "Cancel" : "Payment"}
        </button>
      </div>

      {showForm && (
        <RecordForm
          customers={customersQ.data ?? []}
          customersLoading={customersQ.isLoading}
          onDone={() => setShowForm(false)}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="agent-card p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--brand-ink)]/55">
            <Clock className="h-3.5 w-3.5" style={{ color: "#b45309" }} /> Pending
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{pending.length}</div>
          <div className="text-[10px] tabular-nums text-[var(--brand-ink)]/50">{inr(pendingTotal)} waiting</div>
        </div>
        <div className="agent-card p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--brand-ink)]/55">
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--brand-emerald)" }} /> Approved
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{approved.length}</div>
          <div className="text-[10px] tabular-nums text-[var(--brand-ink)]/50">in the ledger</div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-ink)]/50">
          My recordings
        </div>
        {paysQ.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
            ))}
          </div>
        ) : paysQ.isError ? (
          <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
            {paysQ.error.message}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-xs text-[var(--brand-ink)]/40" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
            <Wallet className="mx-auto mb-2 h-8 w-8 opacity-30" />
            No recordings yet. Tap “Record Payment” to add the first one.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((p) => {
              const meta = STATUS_META[p.status] ?? STATUS_META.pending;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="agent-press agent-card p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums">{inr(p.amount)}</span>
                    <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-[var(--brand-ink)]/55">
                    {p.plotNumber ? `Plot ${p.plotNumber}${p.plotBlock ? ` · ${p.plotBlock}` : ""}` : "—"}
                    {p.customerName ? ` · ${p.customerName}` : ""}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-[var(--brand-ink)]/40">
                    <span>{new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {p.proofCount > 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> {p.proofCount}
                      </span>
                    )}
                  </div>
                  {p.status === "rejected" && p.rejectionRemark && (
                    <div className="mt-1.5 rounded-lg px-2 py-1 text-[11px]" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
                      Reason: {p.rejectionRemark}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && <RecordingSheet item={selected} onClose={() => setSelectedId(null)} />}
    </section>
  );
}

function CustomerPicker({
  customers,
  onPick,
  onClose,
}: {
  customers: BmCustomer[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = query
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.phone ?? "").includes(query) ||
          (c.city ?? "").toLowerCase().includes(query) ||
          c.plots.some((p) => p.plotNumber.toLowerCase().includes(query)),
      )
    : customers;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
        <button onClick={onClose} className="agent-press rounded-lg p-1.5" aria-label="Close">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-sm font-semibold">Select customer</div>
      </header>
      <div className="border-b px-4 py-2" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, #e5e0d4)" }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, or plot no."
          className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--brand-ink)]/40">No customers match.</div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="agent-press flex w-full items-center gap-3 border-b py-3 text-left"
              style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, transparent)" }}
            >
              {c.photo ? (
                <img src={c.photo} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: "var(--brand-emerald)" }}
                >
                  {initials(c.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="truncate text-[11px] text-[var(--brand-ink)]/55">
                  {c.phone ? `${c.phone} · ` : ""}Plot {c.plots.map((p) => p.plotNumber).join(", ")}
                </div>
                {(c.city || c.occupation) && (
                  <div className="truncate text-[10px] text-[var(--brand-ink)]/40">
                    {[c.city, c.occupation].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: c.totalOutstanding > 0 ? "var(--brand-checkout)" : "var(--brand-emerald)" }}
                >
                  {c.totalOutstanding > 0 ? inrCompact(c.totalOutstanding) : "Cleared"}
                </div>
                <div className="text-[10px] text-[var(--brand-ink)]/45">due</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function CustomerCard({ customer: c, onChange }: { customer: BmCustomer; onChange: () => void }) {
  const place = [c.address, c.city, c.state].filter(Boolean).join(", ");
  return (
    <div className="rounded-xl border bg-white p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}>
      <div className="flex items-center gap-3">
        {c.photo ? (
          <img src={c.photo} alt="" className="h-11 w-11 flex-shrink-0 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: "var(--brand-emerald)" }}
          >
            {initials(c.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{c.name}</div>
          <div className="truncate text-[11px] tabular-nums text-[var(--brand-ink)]/55">
            {c.phone ?? "No phone"}{c.alternatePhone ? ` · ${c.alternatePhone}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onChange}
          className="agent-press shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
          style={{ background: "color-mix(in srgb, var(--brand-emerald) 10%, white)", color: "var(--brand-emerald)" }}
        >
          Change
        </button>
      </div>
      {(c.email || place || c.occupation) && (
        <div className="mt-2 space-y-0.5 border-t pt-2 text-[11px] text-[var(--brand-ink)]/65" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, transparent)" }}>
          {c.email && <div className="truncate">✉ {c.email}</div>}
          {place && <div className="truncate">⌂ {place}</div>}
          {c.occupation && <div className="truncate">⚒ {c.occupation}</div>}
        </div>
      )}
      {c.remarks && (
        <div className="mt-1.5 rounded-lg px-2 py-1 text-[11px] text-[var(--brand-ink)]/55" style={{ background: "color-mix(in srgb, var(--brand-gold) 8%, white)" }}>
          {c.remarks}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function RecordForm({ customers, customersLoading, onDone }: { customers: BmCustomer[]; customersLoading: boolean; onDone: () => void }) {
  const record = useRecordBmPayment();
  const [customerId, setCustomerId] = useState("");
  const [plotId, setPlotId] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("cash");
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState("");
  const [cheque, setCheque] = useState("");
  const [txn, setTxn] = useState("");
  const [remarks, setRemarks] = useState("");
  const [proofs, setProofs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const plot: BmPlotOption | null =
    customer?.plots.find((p) => p.id === plotId) ?? customer?.plots[0] ?? null;
  const effectivePlotId = plot?.id ?? "";
  const today = new Date().toISOString().slice(0, 10);

  function pickCustomer(id: string) {
    setCustomerId(id);
    // Single-plot customers skip plot selection entirely.
    const c = customers.find((x) => x.id === id);
    setPlotId(c && c.plots.length === 1 ? (c.plots[0]?.id ?? "") : "");
    setShowPicker(false);
  }

  async function addProofs(files: FileList | null) {
    if (!files || files.length === 0) return;
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (proofs.length + images.length > 3) {
      toast.error("Maximum 3 proof images.");
      return;
    }
    setUploading(true);
    try {
      const next = [...proofs];
      for (const f of images.slice(0, 3 - proofs.length)) {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch("/api/bm/upload", { method: "POST", credentials: "include", body: form });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d?.path) {
          toast.error(d?.error ?? "Upload failed.");
          break;
        }
        next.push(d.path);
        setProofs([...next]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) {
      toast.error("Select a customer.");
      return;
    }
    if (!effectivePlotId) {
      toast.error("Select a plot.");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    try {
      await record.mutateAsync({
        plotId: effectivePlotId,
        date,
        amount: amt,
        paymentMode: mode,
        referenceNumber: reference.trim() || undefined,
        bank: bank.trim() || undefined,
        chequeNumber: cheque.trim() || undefined,
        transactionId: txn.trim() || undefined,
        remarks: remarks.trim() || undefined,
        proofUrls: proofs,
      });
      toast.success("Sent for approval", {
        description: "The amount reflects in the ledger after admin approval.",
      });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record payment.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)", background: "color-mix(in srgb, var(--brand-emerald) 3%, white)" }}>
      {!customer && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--brand-ink)]/70">Customer *</span>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="agent-press flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2.5 text-left text-sm"
            style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          >
            <span className="text-[var(--brand-ink)]/40">
              {customersLoading ? "Loading customers..." : "Select customer"}
            </span>
            <ChevronLeft className="h-4 w-4 rotate-180 text-[var(--brand-ink)]/40" />
          </button>
        </div>
      )}

      {showPicker && (
        <CustomerPicker
          customers={customers}
          onPick={pickCustomer}
          onClose={() => setShowPicker(false)}
        />
      )}

      {customer && (
        <CustomerCard customer={customer} onChange={() => setShowPicker(true)} />
      )}

      {customer && customer.plots.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--brand-ink)]/70">Plot *</span>
          <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {customer.plots.map((p) => {
              const active = effectivePlotId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlotId(p.id)}
                  className="agent-press shrink-0 rounded-xl border px-3 py-2 text-left"
                  style={{
                    borderColor: active ? "var(--brand-emerald)" : "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)",
                    background: active ? "color-mix(in srgb, var(--brand-emerald) 8%, white)" : "#fff",
                  }}
                >
                  <div className="text-xs font-semibold">Plot {p.plotNumber}</div>
                  <div className="text-[10px] tabular-nums" style={{ color: "var(--brand-checkout)" }}>
                    Due {inrCompact(p.balance)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {plot && (
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-white p-2.5 text-center" style={{ border: "1px solid color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
          <MiniStat label="Price" value={inrCompact(plot.totalPrice)} />
          <MiniStat label="Paid" value={inrCompact(plot.paid)} good />
          <MiniStat label="Balance" value={inrCompact(plot.balance)} alert />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹) *">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" placeholder="50000" className={inputCls} />
        </Field>
        <Field label="Date *">
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
            {MODES.map((m) => (
              <option key={m} value={m}>{m.replace("_", " ")}</option>
            ))}
          </select>
        </Field>
        <Field label="Reference no.">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Bank">
          <input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="HDFC Bank" className={inputCls} />
        </Field>
        <Field label="Cheque no.">
          <input value={cheque} onChange={(e) => setCheque(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <Field label="Transaction ID (UTR)">
        <input value={txn} onChange={(e) => setTxn(e.target.value)} className={inputCls} />
      </Field>

      <Field label="Remarks">
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[var(--brand-ink)]/70">
          Proof photos {proofs.length > 0 && `(${proofs.length}/3)`}
        </span>
        <div className="flex flex-wrap gap-2">
          {proofs.map((p) => (
            <div key={p} className="relative">
              <ProofThumb path={p} />
              <button
                type="button"
                onClick={() => setProofs(proofs.filter((x) => x !== p))}
                aria-label="Remove proof"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {proofs.length < 3 && (
            <div className="flex gap-2">
              <label className="agent-press flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-[var(--brand-ink)]/40" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 25%, #e5e0d4)" }}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { void addProofs(e.target.files); e.target.value = ""; }}
                />
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                <span className="text-[9px]">{uploading ? "..." : "Camera"}</span>
              </label>
              <label className="agent-press flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-[var(--brand-ink)]/40" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 25%, #e5e0d4)" }}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { void addProofs(e.target.files); e.target.value = ""; }}
                />
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                <span className="text-[9px]">{uploading ? "..." : "Gallery"}</span>
              </label>
            </div>
          )}
        </div>
        <span className="text-[10px] text-[var(--brand-ink)]/45">Receipt / screenshot / challan — up to 3</span>
      </div>

      {record.isError && (
        <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
          {record.error.message}
        </div>
      )}

      <button
        type="submit"
        disabled={record.isPending || uploading}
        className="agent-press flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--brand-emerald)" }}
      >
        {(record.isPending || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
        {record.isPending ? "Submitting..." : uploading ? "Uploading proof..." : "Submit for Approval"}
      </button>
    </form>
  );
}

function RecordingSheet({ item, onClose }: { item: BmRecording; onClose: () => void }) {
  const meta = STATUS_META[item.status] ?? STATUS_META.pending;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
        <button onClick={onClose} className="agent-press rounded-lg p-1.5" aria-label="Close">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold tabular-nums">{inr(item.amount)}</div>
          <div className="truncate text-[10px] text-[var(--brand-ink)]/50">
            {item.plotNumber ? `Plot ${item.plotNumber}` : ""}{item.customerName ? ` · ${item.customerName}` : ""}
          </div>
        </div>
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
          {meta.label}
        </span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info label="Date" value={new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
          <Info label="Mode" value={item.paymentMode.replace("_", " ")} />
          {item.referenceNumber && <Info label="Reference" value={item.referenceNumber} mono />}
          {item.transactionId && <Info label="Txn ID" value={item.transactionId} mono />}
          {item.bank && <Info label="Bank" value={item.bank} />}
          {item.chequeNumber && <Info label="Cheque" value={item.chequeNumber} mono />}
        </div>
        {item.remarks && (
          <div className="rounded-xl border p-3 text-xs leading-relaxed" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
            <span className="text-[var(--brand-ink)]/45">Remarks: </span>{item.remarks}
          </div>
        )}
        {item.status === "rejected" && item.rejectionRemark && (
          <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
            Rejected by admin: {item.rejectionRemark}
          </div>
        )}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-ink)]/50">
            Proof photos ({item.proofs.length})
          </div>
          {item.proofs.length === 0 ? (
            <div className="text-xs text-[var(--brand-ink)]/40">No proofs attached.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {item.proofs.map((p) => (
                <ProofImage key={p} path={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProofThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useProofUrl(path, setUrl);
  if (!url) return <div className="h-16 w-16 animate-pulse rounded-xl bg-black/5" />;
  return <img src={url} alt="Proof" className="h-16 w-16 rounded-xl border object-cover" />;
}

function ProofImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useProofUrl(path, setUrl);
  if (!url) return <div className="h-24 w-24 animate-pulse rounded-xl bg-black/5" />;
  return (
    <>
      <button onClick={() => setOpen(true)} className="agent-press">
        <img src={url} alt="Proof of payment" className="h-24 w-24 rounded-xl border object-cover" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
          <img src={url} alt="Proof of payment" className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain" />
        </div>
      )}
    </>
  );
}

function useProofUrl(path: string, setUrl: (u: string | null) => void) {
  useEffect(() => {
    let live = true;
    fetch(`/api/bm/proof-url?path=${encodeURIComponent(path)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (live && d?.url) setUrl(d.url); })
      .catch(() => {});
    return () => { live = false; };
  }, [path, setUrl]);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--brand-ink)]/70">{label}</label>
      {children}
    </div>
  );
}

function MiniStat({ label, value, good, alert }: { label: string; value: string; good?: boolean; alert?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--brand-ink)]/50">{label}</div>
      <div
        className="text-xs font-semibold tabular-nums"
        style={good ? { color: "var(--brand-emerald)" } : alert ? { color: "var(--brand-checkout)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-black/[0.03] px-3 py-2">
      <div className="text-[10px] text-[var(--brand-ink)]/45">{label}</div>
      <div className={`mt-0.5 text-xs font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function inr(n: number): string {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function inrCompact(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return inr(n);
}

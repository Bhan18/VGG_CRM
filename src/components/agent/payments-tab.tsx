"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Wallet,
  Search,
  Loader2,
  MapPin,
  User,
  Phone,
  IndianRupee,
  Calendar,
  FileText,
  UploadCloud,
  X,
  CheckCircle2,
  Clock3,
  AlertCircle,
  RefreshCw,
  Building2,
  Hash,
} from "lucide-react";

type SearchResult = {
  plots: Array<{
    id: string;
    plotNumber: string;
    block: string;
    status: string;
    size: number;
    sizeUnit: string;
    totalPrice: number;
    projectId: string;
    projectName: string | null;
    customerId: string | null;
    customerName: string | null;
    customerPhone: string | null;
  }>;
  customerPlots: Array<{ id: string; plotNumber: string; block: string; status: string; projectId: string; projectName: string | null; customerId: string }>;
  customers: Array<{ id: string; name: string; phone: string | null; email: string | null; fatherName: string | null }>;
  projects: Array<{ id: string; name: string; location: string | null }>;
};

type ContextData = {
  plot: { id: string; plotNumber: string; block: string; status: string; size: number; sizeUnit: string; totalPrice: number; pricePerCent: number; projectId: string; customerId: string | null } | null;
  project: { id: string; name: string; location: string | null } | null;
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  booking: any;
  sale: any;
  customerPlots: Array<{ id: string; plotNumber: string; block: string; status: string; projectId: string; totalPrice: number; projectName: string | null }>;
  payments: Array<{ id: string; amount: number; status: string; date: string; payment_mode: string }>;
  summary: { totalApproved: number; totalPending: number; totalRejected: number; count: number };
};

type MyPayment = {
  id: string;
  plotLabel: string | null;
  customerName: string | null;
  amount: number;
  paymentMode: string;
  date: string;
  status: string;
  remarks: string | null;
  createdAt: string;
};

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "neft", label: "NEFT" },
  { value: "rtgs", label: "RTGS" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
] as const;

function fmtINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function PaymentsTab() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchRes, setSearchRes] = useState<SearchResult | null>(null);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [context, setContext] = useState<ContextData | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [myPayments, setMyPayments] = useState<MyPayment[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string>("cash");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refNo, setRefNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [proofUrls, setProofUrls] = useState<string[]>([]);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // debounce q
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const fetchSearch = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchRes(null); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/crm/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Search failed");
      setSearchRes(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSearching(false); }
  }, []);

  useEffect(() => { if (debouncedQ) fetchSearch(debouncedQ); else setSearchRes(null); }, [debouncedQ, fetchSearch]);

  const fetchContext = useCallback(async (plotId: string | null, customerId: string | null) => {
    if (!plotId && !customerId) { setContext(null); return; }
    setCtxLoading(true);
    try {
      const params = new URLSearchParams();
      if (plotId) params.set("plotId", plotId);
      else if (customerId) params.set("customerId", customerId);
      const res = await fetch(`/api/crm/context?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load context");
      setContext(data);
      // auto-select plot/customer from context to keep form in sync
      if (data.plot?.id) setSelectedPlotId(data.plot.id);
      if (data.customer?.id) setSelectedCustomerId(data.customer.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setCtxLoading(false); }
  }, []);

  const fetchMyPayments = useCallback(async () => {
    setMyLoading(true);
    try {
      const res = await fetch(`/api/crm/payments?mine=1&limit=30`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setMyPayments(data.payments ?? []);
    } catch (e) {
      // silent
    } finally { setMyLoading(false); }
  }, []);

  useEffect(() => { fetchMyPayments(); }, [fetchMyPayments]);

  const handleSelectPlot = (id: string) => {
    setSelectedPlotId(id);
    setSelectedCustomerId(null);
    setQ("");
    setSearchRes(null);
    fetchContext(id, null);
    setShowForm(true);
  };
  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    setSelectedPlotId(null);
    setQ("");
    setSearchRes(null);
    fetchContext(null, id);
    setShowForm(true);
  };

  const balance = useMemo(() => {
    if (!context?.plot) return null;
    const total = context.plot.totalPrice ?? 0;
    const paid = context.summary.totalApproved ?? 0;
    return Math.max(0, total - paid);
  }, [context]);

  const uploadProof = async (file: File) => {
    if (proofUrls.length >= 3) { toast.error("Max 3 proofs per payment"); return; }
    setUploadingProof(true);
    try {
      const qs = new URLSearchParams({ name: file.name });
      const r1 = await fetch(`/api/crm/payment-proof-upload-url?${qs.toString()}`, { credentials: "include" });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1?.error ?? j1?.detail ?? "Upload URL failed");
      const putRes = await fetch(j1.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      setProofUrls((prev) => [...prev, j1.path]);
      toast.success("Proof uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setUploadingProof(false); }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (!selectedPlotId && !selectedCustomerId) { toast.error("Select a plot or customer first"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/crm/payments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plotId: selectedPlotId,
          customerId: selectedCustomerId,
          amount: amt,
          paymentMode: mode,
          date,
          referenceNumber: refNo || undefined,
          remarks: remarks || undefined,
          proofUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to record payment");
      toast.success(`Payment ₹${amt.toLocaleString("en-IN")} recorded — pending admin approval`);
      setAmount(""); setRefNo(""); setRemarks(""); setProofUrls([]);
      fetchMyPayments();
      if (selectedPlotId) fetchContext(selectedPlotId, null);
      else if (selectedCustomerId) fetchContext(null, selectedCustomerId);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSubmitting(false); }
  };

  return (
    <section className="space-y-4 px-4 pb-6 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "var(--brand-emerald)", color: "white" }}>
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Payments</h2>
            <p className="text-[11px] text-[var(--brand-ink)]/50">Branch Manager — records go to admin for approval</p>
          </div>
        </div>
        <button onClick={fetchMyPayments} className="agent-press rounded-lg p-2" style={{ color: "var(--brand-emerald)" }} aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${myLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-ink)]/35" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search plot (A-12, B-23) or customer name / phone"
          className="w-full rounded-xl border bg-white py-2.5 pl-9 pr-9 text-sm outline-none placeholder:text-[var(--brand-ink)]/35 focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        />
        {searching ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--brand-ink)]/35" /> : q ? (
          <button onClick={() => { setQ(""); setSearchRes(null); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--brand-ink)]/40"><X className="h-4 w-4" /></button>
        ) : null}

        {searchRes && (searchRes.plots.length > 0 || searchRes.customers.length > 0 || searchRes.customerPlots.length > 0) && (
          <div className="absolute left-0 right-0 z-20 mt-2 max-h-[52vh] overflow-auto rounded-xl border bg-white shadow-lg" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}>
            {searchRes.plots.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]/40">Plots</div>
                {searchRes.plots.map((p) => (
                  <button key={p.id} onClick={() => handleSelectPlot(p.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-[color-mix(in_srgb,var(--brand-emerald)_6%,white)]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="rounded bg-[var(--brand-emerald)] px-1.5 py-0.5 text-[10px] font-bold text-white">{p.block}-{p.plotNumber}</span>
                        <span className="truncate text-xs text-[var(--brand-ink)]/60">{p.projectName ?? p.projectId}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.status === "available" ? "bg-emerald-50 text-emerald-700" : p.status === "sold" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>{p.status}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--brand-ink)]/50">
                        {p.customerName ? <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.customerName}{p.customerPhone ? ` · ${p.customerPhone}` : ""}</span> : <span className="text-[var(--brand-ink)]/30">No buyer yet</span>}
                        <span className="hidden sm:inline">· {p.size} {p.sizeUnit} · {fmtINR(p.totalPrice)}</span>
                      </div>
                    </div>
                    <Hash className="h-4 w-4 flex-shrink-0 text-[var(--brand-ink)]/20" />
                  </button>
                ))}
              </div>
            )}
            {searchRes.customers.length > 0 && (
              <div className="border-t p-2" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]/40">Customers</div>
                {searchRes.customers.map((c) => (
                  <button key={c.id} onClick={() => handleSelectCustomer(c.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-[color-mix(in_srgb,var(--brand-emerald)_6%,white)]">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand-emerald)_10%,white)] text-xs font-semibold" style={{ color: "var(--brand-emerald)" }}>{c.name.slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--brand-ink)]/50">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.fatherName && <span>· {c.fatherName}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchRes.customerPlots.length > 0 && (
              <div className="border-t p-2" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]/40">Plots for matched customer</div>
                {searchRes.customerPlots.map((p) => (
                  <button key={p.id} onClick={() => handleSelectPlot(p.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-[color-mix(in_srgb,var(--brand-emerald)_6%,white)]">
                    <span className="text-sm font-medium">{p.projectName ?? ""} {p.block}-{p.plotNumber} <span className="ml-1 text-xs text-[var(--brand-ink)]/40">({p.status})</span></span>
                    <span className="text-xs text-[var(--brand-ink)]/40">Select</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected context card */}
      {(selectedPlotId || selectedCustomerId) && (
        <div className="rounded-2xl border bg-white p-3.5 shadow-sm" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
          {ctxLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--brand-ink)]/40"><Loader2 className="h-4 w-4 animate-spin" /> Loading plot & customer...</div>
          ) : context ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {context.plot ? (
                      <span className="rounded-lg px-2.5 py-1 text-sm font-bold text-white" style={{ background: "var(--brand-emerald)" }}>{context.plot.block}-{context.plot.plotNumber}</span>
                    ) : null}
                    {context.plot && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${context.plot.status === "available" ? "bg-emerald-50 text-emerald-700" : context.plot.status === "sold" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>{context.plot.status}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--brand-ink)]/60">
                    {context.project && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{context.project.name}</span>}
                    {context.plot && <span>· {context.plot.size} {context.plot.sizeUnit} · {fmtINR(context.plot.totalPrice)}</span>}
                  </div>
                  {context.customer && (
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium"><User className="h-3.5 w-3.5 text-[var(--brand-ink)]/40" />{context.customer.name} {context.customer.phone && <span className="text-xs font-normal text-[var(--brand-ink)]/50">· {context.customer.phone}</span>}</div>
                  )}
                </div>
                <button onClick={() => { setSelectedPlotId(null); setSelectedCustomerId(null); setContext(null); setShowForm(false); }} className="rounded-lg p-1.5 text-[var(--brand-ink)]/40 hover:bg-black/5"><X className="h-4 w-4" /></button>
              </div>

              {/* Multi-plot picker when customer has several plots */}
              {context.customerPlots.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {context.customerPlots.map((p) => {
                    const active = context.plot?.id === p.id;
                    return (
                      <button key={p.id} onClick={() => { setSelectedPlotId(p.id); fetchContext(p.id, null); }} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium ${active ? "text-white" : "bg-white text-[var(--brand-ink)]"}`} style={{ borderColor: active ? "var(--brand-emerald)" : "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)", background: active ? "var(--brand-emerald)" : "#fff" }}>
                        {p.projectName ? `${p.projectName} · ` : ""}{p.block}-{p.plotNumber} <span className={`ml-1 ${active ? "text-white/70" : "text-[var(--brand-ink)]/40"}`}>{fmtINR(p.totalPrice)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 rounded-xl p-2.5" style={{ background: "color-mix(in srgb, var(--brand-emerald) 4%, #f8f7f3)" }}>
                <div className="text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]/40">Price</div>
                  <div className="text-sm font-semibold">{context.plot ? fmtINR(context.plot.totalPrice) : "—"}</div>
                </div>
                <div className="text-center border-x" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, transparent)" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Approved Paid</div>
                  <div className="text-sm font-semibold text-emerald-700">{fmtINR(context.summary.totalApproved)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]/40">Balance</div>
                  <div className="text-sm font-semibold">{balance !== null ? fmtINR(balance) : "—"}</div>
                </div>
              </div>
              {context.summary.totalPending > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "color-mix(in srgb, #f59e0b 10%, white)", color: "#b45309" }}>
                  <Clock3 className="h-3.5 w-3.5" /> Pending approval: {fmtINR(context.summary.totalPending)} ({context.payments.filter((p) => p.status === "pending").length} record(s))
                </div>
              )}
              <button onClick={() => setShowForm((v) => !v)} className="agent-press w-full rounded-xl py-2.5 text-sm font-semibold text-white" style={{ background: "var(--brand-emerald)" }}>
                {showForm ? "Hide form" : "Record new payment"}
              </button>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-[var(--brand-ink)]/40">No plot/customer selected</div>
          )}
        </div>
      )}

      {/* Payment form */}
      {showForm && (selectedPlotId || selectedCustomerId) && (
        <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}>
          <div className="flex items-center gap-2 text-sm font-semibold"><IndianRupee className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} /> New Payment — pending admin approval</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-[var(--brand-ink)]/70">Amount (₹) *</label>
              <input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50000" className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }} required />
              {balance !== null && amount && Number(amount) > balance && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600"><AlertCircle className="h-3 w-3" /> Amount exceeds balance {fmtINR(balance)}</div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--brand-ink)]/70">Mode *</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}>
                {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--brand-ink)]/70">Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--brand-ink)]/70">Ref / Txn / Cheque No.</label>
              <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Optional" className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--brand-ink)]/70">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Any note for admin..." className="w-full resize-none rounded-xl border bg-white px-3 py-2.5 text-sm outline-none" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }} />
          </div>

          {/* Proof upload */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--brand-ink)]/70">Proof (up to 3 images/PDF) — optional</label>
            <div className="flex flex-wrap gap-2">
              {proofUrls.map((p, i) => (
                <div key={p} className="relative flex items-center gap-1 rounded-lg border bg-[color-mix(in_srgb,var(--brand-emerald)_6%,white)] px-2 py-1.5 text-xs" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}>
                  <FileText className="h-3.5 w-3.5" style={{ color: "var(--brand-emerald)" }} /> Proof {i + 1}
                  <button type="button" onClick={() => setProofUrls((prev) => prev.filter((_, j) => j !== i))} className="ml-1 rounded p-0.5 hover:bg-black/5"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadProof(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }} />
            <button type="button" disabled={uploadingProof || proofUrls.length >= 3} onClick={() => fileInputRef.current?.click()} className="agent-press mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium disabled:opacity-50" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)", color: "var(--brand-emerald)" }}>
              {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} {uploadingProof ? "Uploading..." : proofUrls.length >= 3 ? "Max 3 proofs" : "Upload proof"}
            </button>
          </div>

          <button type="submit" disabled={submitting || uploadingProof} className="agent-press flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand-emerald)" }}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {submitting ? "Recording..." : "Record Payment (Pending)"}
          </button>
          <p className="text-center text-[11px] text-[var(--brand-ink)]/40">Payment will be marked <b>pending</b> until an administrator approves it in the admin app.</p>
        </form>
      )}

      {/* My payments history */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-ink)]/50">My recent recordings</h3>
          <span className="text-[11px] text-[var(--brand-ink)]/40">{myPayments.length} records</span>
        </div>
        {myLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--brand-ink)]/40"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
        ) : myPayments.length === 0 ? (
          <div className="rounded-xl border border-dashed py-10 text-center" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
            <Wallet className="mx-auto mb-2 h-8 w-8 opacity-20" />
            <div className="text-xs text-[var(--brand-ink)]/40">No payments recorded yet</div>
            <div className="mx-auto mt-1 max-w-[28ch] text-[11px] text-[var(--brand-ink)]/30">Search a plot or customer above to record your first collection.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {myPayments.map((p) => (
              <div key={p.id} className="rounded-xl border bg-white p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{fmtINR(p.amount)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.status === "approved" ? "bg-emerald-50 text-emerald-700" : p.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>{p.status}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--brand-ink)]/60">
                      {p.plotLabel ?? "—"} {p.customerName ? `· ${p.customerName}` : ""}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--brand-ink)]/40">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{p.date}</span>
                      <span>· {p.paymentMode}</span>
                      {p.remarks && <span className="truncate">· {p.remarks}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {p.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : p.status === "pending" ? <Clock3 className="h-4 w-4 text-amber-600" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                    <span className="text-[10px] text-[var(--brand-ink)]/30">{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background: "color-mix(in srgb, var(--brand-emerald) 4%, #f8f7f3)", color: "color-mix(in srgb, var(--brand-ink) 70%, transparent)" }}>
        <div className="flex gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--brand-emerald)" }} /><span>All payments are stored in the shared admin DB (<b>biqtwnlspyvqdnfgucpl</b>) and appear in <b>admin_app → Payments → Pending Approval</b>. Admin must approve to count toward plot balance & receipts.</span></div>
      </div>
    </section>
  );
}

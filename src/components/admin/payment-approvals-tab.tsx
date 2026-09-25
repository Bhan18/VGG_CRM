"use client";

// Admin payment approvals (staff app) — review BM-recorded pending payments
// with proof photos, then approve (moves the ledger) or reject (remark
// required, visible to the BM). Backed by /api/admin/payments.

import { useMemo, useState, useEffect } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Phone,
  Hourglass,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminFetch } from "@/hooks/admin/use-admin-data";
import {
  SkeletonList,
  EmptyState,
  ErrorState,
} from "@/components/agent/ui-primitives";

type QueueItem = {
  id: string;
  date: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string | null;
  bank: string | null;
  chequeNumber: string | null;
  transactionId: string | null;
  remarks: string | null;
  status: string;
  recordedBy: string | null;
  recordedByName: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionRemark: string | null;
  proofs: string[];
  createdAt: string;
  plotNumber: string | null;
  plotBlock: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

type QueueData = {
  pending: QueueItem[];
  recent: QueueItem[];
};

function isStale(p: QueueItem, days = 2): boolean {
  const t = new Date(p.createdAt || p.date).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > days * 24 * 60 * 60 * 1000;
}

function findDuplicate(all: QueueItem[], p: QueueItem): QueueItem | null {
  const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
  const ref = norm(p.referenceNumber);
  const txn = norm(p.transactionId);
  const chq = norm(p.chequeNumber);
  if (!ref && !txn && !chq) return null;
  return (
    all.find(
      (x) =>
        x.id !== p.id &&
        ((ref && norm(x.referenceNumber) === ref) ||
          (txn && norm(x.transactionId) === txn) ||
          (chq && norm(x.chequeNumber) === chq)),
    ) ?? null
  );
}

export function PaymentApprovalsTab() {
  const { data, loading, error, reload } = useAdminFetch<QueueData>("/api/admin/payments");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<QueueItem | null>(null);
  const [remark, setRemark] = useState("");

  const pending = data?.pending ?? [];
  const recent = data?.recent ?? [];
  const all = useMemo(() => [...pending, ...recent], [pending, recent]);
  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0);

  async function act(id: string, action: "approve" | "reject") {
    if (action === "reject" && !remark.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, id, remark: remark.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Action failed. Try again.");
        return;
      }
      toast.success(action === "approve" ? "Payment approved" : "Payment rejected", {
        description:
          action === "approve"
            ? "Ledger and plot balance updated."
            : "The BM will see your reason.",
      });
      setRejecting(null);
      setRemark("");
      reload();
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) return <SkeletonList count={4} height={140} />;
  if (error && !data) {
    return <ErrorState title="Couldn't load approvals" description={error} onRetry={reload} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          Pending approvals{" "}
          <span className="font-normal text-[var(--brand-ink)]/50">({pending.length})</span>
        </h2>
        {pendingTotal > 0 && (
          <span className="text-xs font-semibold tabular-nums" style={{ color: "#b45309" }}>
            {inr(pendingTotal)} waiting
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="All clear" description="No payments waiting for approval." />
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((p) => {
            const dup = findDuplicate(all, p);
            const busy = busyId === p.id;
            return (
              <article key={p.id} className="agent-card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold tabular-nums">{inr(p.amount)}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--brand-ink)]/55">
                      {p.plotNumber ? `Plot ${p.plotNumber}${p.plotBlock ? ` · ${p.plotBlock}` : ""}` : "—"}
                      {p.customerName ? ` · ${p.customerName}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {isStale(p) && (
                      <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "color-mix(in srgb, #d97706 10%, white)", color: "#b45309" }}>
                        <Hourglass className="h-3 w-3" /> 2+ days
                      </span>
                    )}
                    {dup && (
                      <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }} title={`Same reference as ${inr(dup.amount)} on ${fmtDate(dup.date)}`}>
                        <AlertTriangle className="h-3 w-3" /> Possible duplicate
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[var(--brand-ink)]/65">
                  <span>Mode: <strong className="font-medium capitalize">{p.paymentMode.replace("_", " ")}</strong></span>
                  <span>Date: <strong className="font-medium">{fmtDate(p.date)}</strong></span>
                  {p.referenceNumber && <span>Ref: <strong className="font-mono font-medium">{p.referenceNumber}</strong></span>}
                  {p.transactionId && <span>UTR: <strong className="font-mono font-medium">{p.transactionId}</strong></span>}
                  {p.chequeNumber && <span>Cheque: <strong className="font-mono font-medium">{p.chequeNumber}</strong></span>}
                  {p.bank && <span>Bank: <strong className="font-medium">{p.bank}</strong></span>}
                  <span className="col-span-2 flex items-center gap-1">
                    Recorded by <strong className="font-medium">{p.recordedByName ?? "—"}</strong>
                    <span className="text-[var(--brand-ink)]/40">· {fmtDateTime(p.createdAt)}</span>
                  </span>
                  {p.customerPhone && (
                    <a href={`tel:${p.customerPhone}`} className="col-span-2 flex items-center gap-1 font-medium" style={{ color: "var(--brand-emerald)" }}>
                      <Phone className="h-3 w-3" /> {p.customerPhone}
                    </a>
                  )}
                </div>

                {p.remarks && (
                  <div className="mt-2 rounded-lg px-2 py-1 text-[11px] text-[var(--brand-ink)]/60" style={{ background: "color-mix(in srgb, var(--brand-gold) 8%, white)" }}>
                    {p.remarks}
                  </div>
                )}

                {p.proofs.length > 0 && (
                  <div className="mt-2.5">
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]/45">
                      Proof photos ({p.proofs.length})
                    </div>
                    <div className="flex gap-2">
                      {p.proofs.map((path) => (
                        <ProofImage key={path} path={path} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2 border-t pt-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, transparent)" }}>
                  <button
                    onClick={() => void act(p.id, "approve")}
                    disabled={busy}
                    className="agent-press flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--brand-emerald)" }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => { setRejecting(p); setRemark(""); }}
                    disabled={busy}
                    className="agent-press flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--brand-checkout)" }}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-ink)]/50">
            Recently decided
          </div>
          <div className="flex flex-col gap-1.5">
            {recent.slice(0, 20).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={
                    p.status === "approved"
                      ? { background: "color-mix(in srgb, var(--brand-emerald) 12%, white)", color: "var(--brand-emerald)" }
                      : { background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }
                  }
                >
                  {p.status === "approved" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold tabular-nums">
                    {inr(p.amount)}{p.plotNumber ? ` · Plot ${p.plotNumber}` : ""}{p.customerName ? ` · ${p.customerName}` : ""}
                  </div>
                  <div className="truncate text-[10px] text-[var(--brand-ink)]/45">
                    {p.status === "approved" ? `Approved${p.approvedBy ? ` · ${p.approvedBy}` : ""}` : `Rejected${p.rejectionRemark ? `: ${p.rejectionRemark}` : ""}`}
                  </div>
                </div>
                <Clock className="h-3 w-3 shrink-0 text-[var(--brand-ink)]/30" />
              </div>
            ))}
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setRejecting(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="text-sm font-semibold">Reject {inr(rejecting.amount)}?</div>
            <p className="mt-1 text-xs text-[var(--brand-ink)]/55">
              {rejecting.customerName ?? ""}{rejecting.plotNumber ? ` · Plot ${rejecting.plotNumber}` : ""} — the BM will see your reason.
            </p>
            <textarea
              autoFocus
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
              placeholder="Reason for rejection (required)..."
              className="mt-3 w-full resize-none rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setRejecting(null)}
                className="agent-press flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold"
                style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 20%, #e5e0d4)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => void act(rejecting.id, "reject")}
                disabled={busyId === rejecting.id || !remark.trim()}
                className="agent-press flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand-checkout)" }}
              >
                {busyId === rejecting.id ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProofImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/bm/proof-url?path=${encodeURIComponent(path)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (live && d?.url) setUrl(d.url); })
      .catch(() => {});
    return () => { live = false; };
  }, [path]);

  if (!url) return <div className="h-20 w-20 animate-pulse rounded-xl bg-black/5" />;
  return (
    <>
      <button onClick={() => setOpen(true)} className="agent-press">
        <img src={url} alt="Proof of payment" className="h-20 w-20 rounded-xl border object-cover" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
          <img src={url} alt="Proof of payment" className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain" />
        </div>
      )}
    </>
  );
}

function fmtDate(d: string): string {
  if (!d) return "—";
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(dt.getTime())) return d.slice(0, 10);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(d: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function inr(n: number): string {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

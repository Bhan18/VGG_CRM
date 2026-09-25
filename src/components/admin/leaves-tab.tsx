"use client";

// Admin leave management — list all requests, approve/reject with remark.

import { useCallback, useEffect, useState } from "react";
import {
  CalendarOff,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Filter,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { ConfirmSheet } from "./employees-tab";

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  admin_remark: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  employee: { name: string; employee_code: string; department: string } | null;
}

const STATUS_META: Record<string, { color: string; bg: string; icon: typeof Clock }> = {
  PENDING: { color: "var(--brand-golden)", bg: "color-mix(in srgb, var(--brand-golden) 8%, white)", icon: Clock },
  APPROVED: { color: "var(--brand-emerald)", bg: "color-mix(in srgb, var(--brand-emerald) 8%, white)", icon: CheckCircle2 },
  REJECTED: { color: "var(--brand-checkout)", bg: "color-mix(in srgb, var(--brand-checkout) 8%, white)", icon: XCircle },
  CANCELLED: { color: "#888", bg: "#f5f5f5", icon: XCircle },
};

const LEAVE_LABELS: Record<string, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
  UNPAID: "Unpaid",
};

function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export function LeavesTab() {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("PENDING");
  const [actionId, setActionId] = useState<string | null>(null);
  const [remark, setRemark] = useState("");
  const [showRemarkFor, setShowRemarkFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LeaveRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter ? `/api/attendance/admin/leave?status=${filter}` : "/api/attendance/admin/leave";
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  async function onAction(id: string, status: "APPROVED" | "REJECTED") {
    setActionId(id);
    try {
      const res = await fetch("/api/attendance/admin/leave", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminRemark: remark || null }),
      });
      if (!res.ok) return;
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status, admin_remark: remark || null } : i)));
      setRemark("");
      setShowRemarkFor(null);
    } finally {
      setActionId(null);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/attendance/admin/leave?id=${deleting.id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setItems((prev) => prev.filter((i) => i.id !== deleting.id));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const filters = ["PENDING", "APPROVED", "REJECTED", "ALL"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarOff className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
        <h2 className="text-sm font-semibold">Leave Requests</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f === "ALL" ? "" : f)}
            className="agent-press rounded-lg px-3 py-1.5 text-[11px] font-medium"
            style={
              (filter === "" && f === "ALL") || filter === f
                ? { background: "color-mix(in srgb, var(--brand-emerald) 12%, white)", color: "var(--brand-emerald)" }
                : { color: "var(--brand-ink)/50" }
            }
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-xs text-[var(--brand-ink)]/40">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-xs text-[var(--brand-ink)]/40" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
          No leave requests found.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.CANCELLED;
            const StatusIcon = meta.icon;
            const days = daysBetween(item.start_date, item.end_date);
            return (
              <div
                key={item.id}
                className="rounded-xl border p-3"
                style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{item.employee?.name ?? "Unknown"}</span>
                      <span className="text-[10px] text-[var(--brand-ink)]/40">{item.employee?.employee_code}</span>
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
                        {item.status}
                      </span>
                    </div>                    <div className="mt-1 text-[11px] text-[var(--brand-ink)]/55">
                      {LEAVE_LABELS[item.leave_type] ?? item.leave_type} · {item.start_date} → {item.end_date} ({days} {days === 1 ? "day" : "days"})
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--brand-ink)]/70">{item.reason}</div>
                    {item.admin_remark && (
                      <div className="mt-1 rounded-lg px-2 py-1 text-[11px] text-[var(--brand-ink)]/50" style={{ background: "color-mix(in srgb, var(--brand-golden) 6%, white)" }}>
                        Remark: {item.admin_remark}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setDeleting(item)}
                    title="Delete request"
                    className="agent-press flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Action buttons for PENDING */}
                {item.status === "PENDING" && (
                  <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, #e5e0d4)" }}>
                    {showRemarkFor === item.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={remark}
                          onChange={(e) => setRemark(e.target.value)}
                          rows={2}
                          placeholder="Add a remark (optional)..."
                          className="rounded-lg border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-2.5 py-2 text-xs outline-none focus:border-[var(--brand-emerald)] resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => void onAction(item.id, "APPROVED")}
                            disabled={actionId === item.id}
                            className="agent-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            style={{ background: "var(--brand-emerald)" }}
                          >
                            {actionId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Approve
                          </button>
                          <button
                            onClick={() => void onAction(item.id, "REJECTED")}
                            disabled={actionId === item.id}
                            className="agent-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            style={{ background: "var(--brand-checkout)" }}
                          >
                            {actionId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                            Reject
                          </button>
                        </div>
                        <button
                          onClick={() => { setShowRemarkFor(null); setRemark(""); }}
                          className="text-[11px] text-[var(--brand-ink)]/40 hover:text-[var(--brand-ink)]/60"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => void onAction(item.id, "APPROVED")}
                          disabled={actionId === item.id}
                          className="agent-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          style={{ background: "var(--brand-emerald)" }}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => void onAction(item.id, "REJECTED")}
                          disabled={actionId === item.id}
                          className="agent-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          style={{ background: "var(--brand-checkout)" }}
                        >
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                        <button
                          onClick={() => setShowRemarkFor(item.id)}
                          className="agent-press flex items-center justify-center rounded-lg px-2.5 py-2 text-xs font-medium"
                          style={{ background: "color-mix(in srgb, var(--brand-golden) 10%, white)", color: "var(--brand-golden)" }}
                          title="Add remark"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleting && (
        <ConfirmSheet
          title="Delete leave request?"
          body={`Delete the ${LEAVE_LABELS[deleting.leave_type] ?? deleting.leave_type} request from ${deleting.employee?.name ?? "Unknown"} (${deleting.start_date} → ${deleting.end_date})? This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void onDelete()}
        />
      )}
    </div>
  );
}

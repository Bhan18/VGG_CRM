"use client";

// Leaves tab — submit leave request + view history.
// Pulls data from /api/attendance/staff/leave.

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Plus, Loader2, CheckCircle2, Clock, XCircle, Send } from "lucide-react";

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
}

const LEAVE_TYPES = [
  { value: "CASUAL", label: "Casual Leave" },
  { value: "SICK", label: "Sick Leave" },
  { value: "EARNED", label: "Earned Leave" },
  { value: "UNPAID", label: "Unpaid Leave" },
] as const;

const STATUS_META: Record<string, { color: string; bg: string; icon: typeof Clock }> = {
  PENDING: { color: "var(--brand-golden)", bg: "color-mix(in srgb, var(--brand-golden) 8%, white)", icon: Clock },
  APPROVED: { color: "var(--brand-emerald)", bg: "color-mix(in srgb, var(--brand-emerald) 8%, white)", icon: CheckCircle2 },
  REJECTED: { color: "var(--brand-checkout)", bg: "color-mix(in srgb, var(--brand-checkout) 8%, white)", icon: XCircle },
  CANCELLED: { color: "#888", bg: "#f5f5f5", icon: XCircle },
};

function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export function LeaveTab() {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/staff/leave");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!startDate || !endDate) { setError("Select dates."); return; }
    if (endDate < startDate) { setError("End date must be on or after start date."); return; }
    if (!reason.trim()) { setError("Enter a reason."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/staff/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveType, startDate, endDate, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Could not submit request.");
        return;
      }
      setItems((prev) => [data.item, ...prev]);
      setShowForm(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      setLeaveType("CASUAL");
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-4 px-4 pb-6 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarOff className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          <h2 className="text-sm font-semibold">Leaves</h2>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="agent-press flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--brand-emerald)" }}
        >
          {showForm ? "Cancel" : <><Plus className="h-3.5 w-3.5" /> Apply</>}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)", background: "color-mix(in srgb, var(--brand-emerald) 3%, white)" }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--brand-ink)]/70">Start Date</label>
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--brand-ink)]/70">End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)] resize-none"
              placeholder="Why do you need leave?"
            />
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="agent-press flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--brand-emerald)" }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      )}

      {/* History */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-xs text-[var(--brand-ink)]/40">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-xs text-[var(--brand-ink)]/40" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
          <CalendarOff className="mx-auto mb-2 h-8 w-8 opacity-30" />
          No leave requests yet.
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{LEAVE_TYPES.find((t) => t.value === item.leave_type)?.label ?? item.leave_type}</span>
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--brand-ink)]/55">
                      {item.start_date} → {item.end_date} · {days} {days === 1 ? "day" : "days"}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--brand-ink)]/70">{item.reason}</div>
                    {item.admin_remark && (
                      <div className="mt-1 rounded-lg px-2 py-1 text-[11px] text-[var(--brand-ink)]/50" style={{ background: "color-mix(in srgb, var(--brand-golden) 6%, white)" }}>
                        Admin: {item.admin_remark}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

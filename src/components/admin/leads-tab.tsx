"use client";

// Admin leads — browse every employee's CRM leads, view follow-up history,
// delete spam. Backed by /api/attendance/admin/leads.

import { useMemo, useState } from "react";
import {
  Target,
  Search,
  Trash2,
  Loader2,
  Phone,
  Building2,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminFetch } from "@/hooks/admin/use-admin-data";
import {
  SkeletonList,
  EmptyState,
  ErrorState,
} from "@/components/agent/ui-primitives";
import { ConfirmSheet } from "./employees-tab";
import type { LeadStatus } from "@/lib/agent/types";

type AdminLead = {
  id: string;
  employee_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  activity_count: number;
  attendance_employees: {
    id: string;
    employee_code: string;
    name: string;
    department: string;
  };
};

type LeadActivity = {
  id: string;
  type: string;
  content: string;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  NEW: { label: "New", color: "#0e7cb8", bg: "color-mix(in srgb, #0e7cb8 8%, white)" },
  CONTACTED: { label: "Contacted", color: "var(--brand-golden)", bg: "color-mix(in srgb, var(--brand-golden) 8%, white)" },
  FOLLOW_UP: { label: "Follow-up", color: "#8b5cf6", bg: "color-mix(in srgb, #8b5cf6 8%, white)" },
  WON: { label: "Won", color: "var(--brand-emerald)", bg: "color-mix(in srgb, var(--brand-emerald) 8%, white)" },
  LOST: { label: "Lost", color: "var(--brand-checkout)", bg: "color-mix(in srgb, var(--brand-checkout) 8%, white)" },
};

export function LeadsAdminTab() {
  const { data, loading, error, reload } = useAdminFetch<{ items: AdminLead[] }>(
    "/api/attendance/admin/leads",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [selected, setSelected] = useState<AdminLead | null>(null);
  const [deleting, setDeleting] = useState<AdminLead | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of data?.items ?? []) {
      map.set(l.employee_id, l.attendance_employees?.name ?? l.employee_id);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    let list = data?.items ?? [];
    if (status) list = list.filter((l) => l.status === status);
    if (owner) list = list.filter((l) => l.employee_id === owner);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.company ?? "").toLowerCase().includes(q) ||
          (l.phone ?? "").includes(q),
      );
    }
    return list;
  }, [data, search, status, owner]);

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/attendance/admin/leads?id=${deleting.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not delete lead.");
        return;
      }
      toast.success("Lead deleted");
      setDeleting(null);
      setSelected(null);
      reload();
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading && !data) return <SkeletonList count={6} height={84} />;
  if (error && !data) {
    return <ErrorState title="Couldn't load leads" description={error} onRetry={reload} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          Staff leads{" "}
          <span className="font-normal text-[var(--brand-ink)]/50">({filtered.length})</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--brand-ink)]/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lead, company, phone"
            className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--brand-emerald)]"
            style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          />
        </div>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="rounded-xl border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        >
          <option value="">All staff</option>
          {owners.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([v, m]) => (
            <option key={v} value={v}>{m.label}</option>
          ))}
        </select>
      </div>

      {!data || filtered.length === 0 ? (
        <EmptyState icon={Target} title="No leads found" description="Staff leads appear here once they add them." />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l) => {
            const meta = STATUS_META[l.status] ?? STATUS_META.NEW;
            return (
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                className="agent-card agent-press p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{l.name}</span>
                  <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
                    {meta.label}
                  </span>
                </div>
                {(l.company || l.phone) && (
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--brand-ink)]/55">
                    {l.company && (
                      <span className="flex min-w-0 items-center gap-1">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{l.company}</span>
                      </span>
                    )}
                    {l.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {l.phone}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--brand-ink)]/45">
                  <span className="truncate">
                    {l.attendance_employees?.name ?? "—"}
                    {l.attendance_employees ? ` · ${l.attendance_employees.employee_code}` : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 tabular-nums">
                    <Clock className="h-3 w-3" /> {l.activity_count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <LeadDetailSheet
          lead={selected}
          onClose={() => setSelected(null)}
          onDelete={() => setDeleting(selected)}
        />
      )}
      {deleting && (
        <ConfirmSheet
          title="Delete lead?"
          body={`Delete "${deleting.name}" and its ${deleting.activity_count} follow-up entries? This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void onDelete()}
        />
      )}
    </div>
  );
}

function LeadDetailSheet({
  lead,
  onClose,
  onDelete,
}: {
  lead: AdminLead;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { data, loading } = useAdminFetch<{ item: AdminLead; activities: LeadActivity[] }>(
    `/api/attendance/admin/leads?id=${lead.id}`,
  );
  const meta = STATUS_META[lead.status] ?? STATUS_META.NEW;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
        <button onClick={onClose} className="agent-press rounded-lg p-1.5" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{lead.name}</div>
          <div className="truncate text-[10px] text-[var(--brand-ink)]/50">
            {lead.attendance_employees?.name ?? ""} · {lead.company ?? "—"}
          </div>
        </div>
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
          {meta.label}
        </span>
        <button
          onClick={onDelete}
          title="Delete lead"
          className="agent-press flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        {(lead.phone || lead.email || lead.source || lead.notes) && (
          <div className="mb-4 space-y-1.5 rounded-xl border p-3 text-xs" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
            {lead.phone && <div><span className="text-[var(--brand-ink)]/45">Phone: </span>{lead.phone}</div>}
            {lead.email && <div><span className="text-[var(--brand-ink)]/45">Email: </span>{lead.email}</div>}
            {lead.source && <div><span className="text-[var(--brand-ink)]/45">Source: </span>{lead.source}</div>}
            {lead.notes && <div className="whitespace-pre-wrap"><span className="text-[var(--brand-ink)]/45">Notes: </span>{lead.notes}</div>}
          </div>
        )}

        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-ink)]/50">
          Follow-up history
        </div>
        {loading ? (
          <div className="py-6 text-center text-xs text-[var(--brand-ink)]/40">Loading...</div>
        ) : !data || data.activities.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-[var(--brand-ink)]/40" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
            No follow-ups yet.
          </div>
        ) : (
          <div className="space-y-2">
            {data.activities.map((a) => (
              <div key={a.id} className="rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold" style={{ color: "var(--brand-emerald)" }}>
                    {a.type.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-[var(--brand-ink)]/40">
                    {new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--brand-ink)]/80">{a.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
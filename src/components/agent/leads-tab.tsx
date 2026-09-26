"use client";

// My Leads — personal CRM space. Each staff member tracks their own leads
// (potential clients), plus follow-ups and remarks over time.
// Backed by /api/attendance/staff/leads (attendance Supabase).

import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Loader2,
  Mail,
  Building2,
  Phone,
  Info,
  ChevronLeft,
  X,
  Send,
  PhoneCall,
  Handshake,
  Clock,
  MessageSquare,
  NotebookPen,
  UserCheck,
} from "lucide-react";
import {
  useLeads,
  useCreateLead,
  useUpdateLead,
  useAddLeadActivity,
  useLeadDetail,
} from "@/hooks/agent/use-agent-data";
import type { Lead, LeadStatus, LeadActivityType } from "@/lib/agent/types";

const STATUS_ORDER: LeadStatus[] = ["NEW", "CONTACTED", "FOLLOW_UP", "WON", "LOST"];

const STATUS_META: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  NEW: { label: "New", color: "#0e7cb8", bg: "color-mix(in srgb, #0e7cb8 8%, white)" },
  CONTACTED: { label: "Contacted", color: "var(--brand-golden)", bg: "color-mix(in srgb, var(--brand-golden) 8%, white)" },
  FOLLOW_UP: { label: "Follow-up", color: "#8b5cf6", bg: "color-mix(in srgb, #8b5cf6 8%, white)" },
  WON: { label: "Won", color: "var(--brand-emerald)", bg: "color-mix(in srgb, var(--brand-emerald) 8%, white)" },
  LOST: { label: "Lost", color: "var(--brand-checkout)", bg: "color-mix(in srgb, var(--brand-checkout) 8%, white)" },
};

const ACTIVITY_META: Record<LeadActivityType, { label: string; icon: typeof Clock; color: string }> = {
  NOTE: { label: "Note", icon: NotebookPen, color: "#888" },
  CALL: { label: "Call", icon: PhoneCall, color: "#0e7cb8" },
  MEETING: { label: "Meeting", icon: Handshake, color: "#8b5cf6" },
  FOLLOW_UP: { label: "Follow-up", icon: Clock, color: "var(--brand-golden)" },
  REMARK: { label: "Remark", icon: MessageSquare, color: "var(--brand-emerald)" },
};

export function LeadsTab() {
  const { data: leads, isLoading, error } = useLeads();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <section className="space-y-4 px-4 pb-6 pt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          <h2 className="text-sm font-semibold">My Leads</h2>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="agent-press flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--brand-emerald)" }}
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <><Plus className="h-3.5 w-3.5" /> Add</>}
          {showForm ? "Cancel" : "Lead"}
        </button>
      </div>

      {showForm && <LeadForm onDone={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-xs text-[var(--brand-ink)]/40">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your leads...
        </div>
      ) : error ? (
        <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
          {error.message}
        </div>
      ) : !leads || leads.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-xs text-[var(--brand-ink)]/40" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
          <Users className="mx-auto mb-2 h-8 w-8 opacity-30" />
          No leads yet. Tap “Add Lead” to create your first one.
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onOpen={() => setSelectedId(lead.id)} />
          ))}
        </div>
      )}

      {selectedId && <LeadDetailSheet leadId={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  );
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const meta = STATUS_META[lead.status] ?? STATUS_META.NEW;
  return (
    <button
      onClick={onOpen}
      className="agent-press w-full rounded-xl border p-3 text-left"
      style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)", background: "#fff" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{lead.name}</span>
            <span className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
              {meta.label}
            </span>
          </div>
          {(lead.company || lead.phone) && (
            <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--brand-ink)]/55">
              {lead.company && (
                <span className="flex items-center gap-1 min-w-0">
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{lead.company}</span>
                </span>
              )}
              {lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {lead.phone}
                </span>
              )}
            </div>
          )}
          <div className="mt-1.5 text-[10px] text-[var(--brand-ink)]/40">
            Added{" "}
            {new Date(lead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>
    </button>
  );
}

function LeadForm({ onDone }: { onDone: () => void }) {
  const create = useCreateLead();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        source: source.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onDone();
    } catch {
      /* error surfaced below */
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)", background: "color-mix(in srgb, var(--brand-emerald) 3%, white)" }}>
      <Field label="Name *">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="98xxxxxx" className={inputCls} />
        </Field>
        <Field label="Company">
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@mail.com" className={inputCls} />
        </Field>
        <Field label="Source">
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Walk-in, referral..." className={inputCls} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything worth remembering" className={`${inputCls} resize-none`} />
      </Field>

      {create.isError && (
        <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
          {create.error.message}
        </div>
      )}

      <button
        type="submit"
        disabled={create.isPending || !name.trim()}
        className="agent-press flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--brand-emerald)" }}
      >
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {create.isPending ? "Saving..." : "Save Lead"}
      </button>
    </form>
  );
}

const inputCls =
  "rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--brand-ink)]/70">{label}</label>
      {children}
    </div>
  );
}

function LeadDetailSheet({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { data, isLoading, error } = useLeadDetail(leadId);
  const update = useUpdateLead();
  const addActivity = useAddLeadActivity();
  const [status, setStatus] = useState<LeadStatus | null>(null);
  const [activityType, setActivityType] = useState<LeadActivityType>("FOLLOW_UP");
  const [activityText, setActivityText] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ phone: string; email: string; company: string; source: string; notes: string }>({
    phone: "",
    email: "",
    company: "",
    source: "",
    notes: "",
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const lead = data?.lead;

  useEffect(() => {
    if (lead) {
      setForm({
        phone: lead.phone ?? "",
        email: lead.email ?? "",
        company: lead.company ?? "",
        source: lead.source ?? "",
        notes: lead.notes ?? "",
      });
    }
  }, [lead?.id]);

  async function changeStatus(next: LeadStatus) {
    if (!lead || next === lead.status) return;
    setStatus(next);
    try {
      await update.mutateAsync({ id: lead.id, patch: { status: next } });
    } catch {
      setStatus(null);
    }
  }

  async function saveEdit() {
    if (!lead) return;
    try {
      await update.mutateAsync({
        id: lead.id,
        patch: {
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          company: form.company.trim() || undefined,
          source: form.source.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      });
      setEditing(false);
    } catch {
      /* error surfaced below */
    }
  }

  async function submitActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !activityText.trim()) return;
    try {
      await addActivity.mutateAsync({ id: lead.id, type: activityType, content: activityText.trim() });
      setActivityText("");
    } catch {
      /* error surfaced below */
    }
  }

  const meta = lead ? STATUS_META[lead.status] ?? STATUS_META.NEW : undefined;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
        <button onClick={onClose} className="agent-press rounded-lg p-1.5 text-[var(--brand-ink)]" aria-label="Close">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-semibold">{lead?.name ?? "Lead"}</div>
          {meta && (
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, background: meta.bg }}>
              {meta.label}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-xs text-[var(--brand-ink)]/40">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : error || !lead ? (
          <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
            {error?.message ?? "Could not load lead."}
          </div>
        ) : (
          <div className="space-y-4">
            <StatusRow current={lead.status} busy={!!status} onChange={changeStatus} error={update.isError ? update.error.message : null} />

            <div>
              <SectionTitle>Details</SectionTitle>
              {!editing ? (
                <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
                  <DetailRow icon={Phone} value={lead.phone ?? "—"} />
                  <DetailRow icon={Mail} value={lead.email ?? "—"} />
                  <DetailRow icon={Building2} value={lead.company ?? "—"} />
                  <DetailRow icon={Info} value={lead.source ?? "—"} label="Source" />
                  {lead.notes && <DetailRow icon={MessageSquare} value={lead.notes} label="Notes" multi />}
                  <button onClick={() => setEditing(true)} className="agent-press mt-1 rounded-lg text-xs font-semibold" style={{ color: "var(--brand-emerald)" }}>
                    Edit details
                  </button>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
                    <Field label="Company"><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputCls} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
                    <Field label="Source"><input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputCls} /></Field>
                  </div>
                  <Field label="Notes">
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={`${inputCls} resize-none`} />
                  </Field>
                  {update.isError && (
                    <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
                      {update.error.message}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="agent-press flex-1 rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 20%, #e5e0d4)", color: "var(--brand-ink)" }}>
                      Cancel
                    </button>
                    <button onClick={saveEdit} disabled={update.isPending} className="agent-press flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand-emerald)" }}>
                      {update.isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <SectionTitle>Add follow-up / remark</SectionTitle>
              <form onSubmit={submitActivity} className="space-y-2">
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {(Object.keys(ACTIVITY_META) as LeadActivityType[]).map((t) => {
                    const m = ACTIVITY_META[t];
                    const active = activityType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setActivityType(t)}
                        className="agent-press flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium"
                        style={{
                          borderColor: active ? m.color : "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)",
                          color: active ? m.color : "var(--brand-ink)",
                          background: active ? "color-mix(in srgb, " + m.color + " 8%, white)" : "#fff",
                        }}
                      >
                        <m.icon className="h-3 w-3" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={activityText}
                  onChange={(e) => setActivityText(e.target.value)}
                  rows={2}
                  placeholder={`Write a ${ACTIVITY_META[activityType].label.toLowerCase()}...`}
                  className={`${inputCls} w-full resize-none`}
                />
                {addActivity.isError && (
                  <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
                    {addActivity.error.message}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={addActivity.isPending || !activityText.trim()}
                  className="agent-press flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--brand-emerald)" }}
                >
                  {addActivity.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Add {ACTIVITY_META[activityType].label}
                </button>
              </form>
            </div>

            <div>
              <SectionTitle>Timeline</SectionTitle>
              {!data.activities || data.activities.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-[var(--brand-ink)]/40" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
                  No follow-ups yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.activities.map((a) => {
                    const m = ACTIVITY_META[a.type] ?? ACTIVITY_META.NOTE;
                    const Icon = m.icon;
                    return (
                      <div key={a.id} className="flex gap-3 rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ color: m.color, background: "color-mix(in srgb, " + m.color + " 8%, white)" }}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold" style={{ color: m.color }}>{m.label}</span>
                            <span className="text-[10px] text-[var(--brand-ink)]/40">
                              {new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--brand-ink)]/80">{a.content}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({
  current,
  busy,
  onChange,
  error,
}: {
  current: LeadStatus;
  busy: boolean;
  onChange: (s: LeadStatus) => void;
  error: string | null;
}) {
  return (
    <div>
      <SectionTitle>Status</SectionTitle>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s];
          const active = current === s;
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              disabled={busy}
              className="agent-press flex shrink-0 items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-60"
              style={{
                borderColor: active ? m.color : "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)",
                color: active ? m.color : "var(--brand-ink)",
                background: active ? m.bg : "#fff",
              }}
            >
              {busy && active ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {m.label}
            </button>
          );
        })}
      </div>
      {error && (
        <div className="mt-2 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-ink)]/50">{children}</div>;
}

function DetailRow({
  icon: Icon,
  value,
  label,
  multi,
}: {
  icon: typeof Phone;
  value: string;
  label?: string;
  multi?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--brand-ink)]/35" />
      <div className="min-w-0">
        <span className={`text-[var(--brand-ink)]/70 ${multi ? "" : "truncate"} block`}>
          {label && <span className="mr-1 text-[var(--brand-ink)]/40">{label}: </span>}
          {value}
        </span>
      </div>
    </div>
  );
}
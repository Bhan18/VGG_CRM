"use client";

// Admin salary — add/edit salary settings per employee, compute monthly
// salary (one or all), and move records DRAFT -> APPROVED -> PAID.
// Backed by /api/attendance/admin/salary.

import { useState } from "react";
import {
  Banknote,
  User,
  Plus,
  Pencil,
  Loader2,
  X,
  Calculator,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminFetch } from "@/hooks/admin/use-admin-data";
import {
  SkeletonList,
  EmptyState,
  ErrorState,
} from "@/components/agent/ui-primitives";

type SalaryEmployee = {
  id: string;
  employee_code: string;
  name: string;
  department: string;
};

type SalarySettings = {
  id: string;
  employee_id: string;
  base_salary: number;
  hra_allowance: number;
  travel_allowance: number;
  special_allowance: number;
  pf_deduction: number;
  other_deduction: number;
  allowed_holidays_per_month: number;
  per_day_rate_override: number | null;
  notes: string | null;
  employee: SalaryEmployee;
};

type SalaryRecord = {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  present_days: number;
  late_days: number;
  half_days: number;
  absent_days: number;
  on_leave_days: number;
  gross_salary: number;
  net_salary: number;
  attendance_deduction: number;
  status: "DRAFT" | "APPROVED" | "PAID";
  employee: SalaryEmployee;
};

type SalaryData = {
  settings: SalarySettings[];
  records: SalaryRecord[];
};

type EmployeeOption = { id: string; employeeCode: string; name: string };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const inputCls =
  "w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]";

export function SalaryTab() {
  const { data, loading, error, reload } = useAdminFetch<SalaryData>(
    "/api/attendance/admin/salary",
  );
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SalarySettings | null>(null);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [computing, setComputing] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  async function computeAll() {
    setComputing(true);
    try {
      const res = await fetch("/api/attendance/admin/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "compute", month, year }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not compute salary.");
        return;
      }
      const errs = d?.errors?.length ?? 0;
      toast.success(`Computed salary for ${d?.computed ?? 0} employees`, {
        description: errs > 0 ? `${errs} failed (missing settings?)` : `${MONTHS[month - 1]} ${year}`,
      });
      reload();
    } finally {
      setComputing(false);
    }
  }

  async function setRecordStatus(id: string, status: "APPROVED" | "PAID") {
    setStatusBusy(id);
    try {
      const res = await fetch("/api/attendance/admin/salary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not update record.");
        return;
      }
      toast.success(status === "APPROVED" ? "Salary approved" : "Marked as paid");
      reload();
    } finally {
      setStatusBusy(null);
    }
  }

  if (loading && !data) return <SkeletonList count={6} height={72} />;
  if (error && !data) {
    return <ErrorState title="Couldn't load salary" description={error} onRetry={reload} />;
  }
  if (!data) return <EmptyState icon={Banknote} title="No salary data" />;

  return (
    <div className="flex flex-col gap-5">
      {/* Compute bar */}
      <div className="agent-card flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Calculator className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          Compute salary
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          aria-label="Month"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          aria-label="Year"
        >
          {[0, 1, 2].map((d) => {
            const y = new Date().getFullYear() - d;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
        <button
          onClick={() => void computeAll()}
          disabled={computing}
          className="agent-press ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--brand-emerald)" }}
        >
          {computing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
          {computing ? "Computing..." : "Compute all"}
        </button>
      </div>

      {/* Settings */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--brand-ink)]/70">Salary settings</h3>
          <button
            onClick={() => setShowForm(true)}
            className="agent-press flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
            style={{ background: "var(--brand-emerald)" }}
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {data.settings.length === 0 ? (
          <EmptyState
            icon={User}
            title="No salary settings"
            description="Add base salary + allowances for each employee first."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.settings.map((s) => {
              const total = s.base_salary + s.hra_allowance + s.travel_allowance + s.special_allowance;
              const net = total - s.pf_deduction - s.other_deduction;
              return (
                <div key={s.id} className="agent-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{s.employee.name}</div>
                      <div className="truncate text-[10px] text-[var(--brand-ink)]/55">
                        {s.employee.department} · {s.employee.employee_code}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-base font-semibold tabular-nums">₹{net.toLocaleString("en-IN")}</div>
                        <div className="text-[10px] text-[var(--brand-ink)]/50">net / month</div>
                      </div>
                      <button
                        onClick={() => setEditing(s)}
                        title="Edit settings"
                        className="agent-press flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 text-black/60"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                    <Row label="Base" value={s.base_salary} />
                    <Row label="HRA" value={s.hra_allowance} />
                    <Row label="Travel" value={s.travel_allowance} />
                    <Row label="Special" value={s.special_allowance} />
                    <Row label="PF" value={s.pf_deduction} />
                    <Row label="Other deductions" value={s.other_deduction} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Records */}
      <section>
        <h3 className="mb-2 text-xs font-semibold text-[var(--brand-ink)]/70">Computed salary records</h3>
        {data.records.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No computed records"
            description="Pick a month above and tap Compute all."
          />
        ) : (
          <div className="agent-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/50">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="px-2 py-2 font-medium">Month</th>
                    <th className="px-2 py-2 font-medium">P / L / H / A</th>
                    <th className="px-2 py-2 text-right font-medium">Net</th>
                    <th className="px-2 py-2 text-right font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, transparent)" }}>
                      <td className="px-4 py-2.5 font-medium">{r.employee.name}</td>
                      <td className="px-2 py-2.5 tabular-nums">{MONTHS[r.month - 1]} {r.year}</td>
                      <td className="px-2 py-2.5 tabular-nums text-[var(--brand-ink)]/70">
                        {r.present_days}/{r.late_days}/{r.half_days}/{r.absent_days}
                      </td>
                      <td className="px-2 py-2.5 text-right font-medium tabular-nums">₹{r.net_salary.toLocaleString("en-IN")}</td>
                      <td className="px-2 py-2.5 text-right">
                        <span className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium" style={statusStyle(r.status)}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "DRAFT" && (
                            <button
                              onClick={() => void setRecordStatus(r.id, "APPROVED")}
                              disabled={statusBusy === r.id}
                              className="agent-press flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-60"
                              style={{ background: "color-mix(in srgb, var(--brand-gold) 15%, white)", color: "#8a6d24" }}
                            >
                              {statusBusy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Approve
                            </button>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              onClick={() => void setRecordStatus(r.id, "PAID")}
                              disabled={statusBusy === r.id}
                              className="agent-press flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-60"
                              style={{ background: "color-mix(in srgb, var(--brand-emerald) 12%, white)", color: "var(--brand-emerald)" }}
                            >
                              {statusBusy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wallet className="h-3 w-3" />}
                              Mark paid
                            </button>
                          )}
                          {r.status === "PAID" && (
                            <span className="text-[11px] text-[var(--brand-ink)]/40">Done</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {(showForm || editing) && (
        <SettingsForm
          initial={editing}
          existingEmployeeIds={data.settings.map((s) => s.employee_id)}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function SettingsForm({
  initial,
  existingEmployeeIds,
  onClose,
  onSaved,
}: {
  initial: SalarySettings | null;
  existingEmployeeIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: empData } = useAdminFetch<{ employees: EmployeeOption[] }>(
    "/api/attendance/admin/employees",
  );
  const [employeeId, setEmployeeId] = useState(initial?.employee_id ?? "");
  const [base, setBase] = useState(String(initial?.base_salary ?? ""));
  const [hra, setHra] = useState(String(initial?.hra_allowance ?? 0));
  const [travel, setTravel] = useState(String(initial?.travel_allowance ?? 0));
  const [special, setSpecial] = useState(String(initial?.special_allowance ?? 0));
  const [pf, setPf] = useState(String(initial?.pf_deduction ?? 0));
  const [other, setOther] = useState(String(initial?.other_deduction ?? 0));
  const [holidays, setHolidays] = useState(String(initial?.allowed_holidays_per_month ?? 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = (empData?.employees ?? []).filter(
    (o) => o.id === initial?.employee_id || !existingEmployeeIds.includes(o.id),
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!employeeId) {
      setError("Select an employee.");
      return;
    }
    const baseSalary = Number(base);
    if (!Number.isFinite(baseSalary) || baseSalary <= 0) {
      setError("Base salary must be a positive number.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/admin/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "upsert-settings",
          employeeId,
          baseSalary,
          hraAllowance: Number(hra) || 0,
          travelAllowance: Number(travel) || 0,
          specialAllowance: Number(special) || 0,
          pfDeduction: Number(pf) || 0,
          otherDeduction: Number(other) || 0,
          allowedHolidaysPerMonth: Number(holidays) || 0,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error ?? "Could not save settings.");
        return;
      }
      toast.success("Salary settings saved");
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{initial ? "Edit salary settings" : "Add salary settings"}</div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="Employee *">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={!!initial} className={`${inputCls} disabled:opacity-60`}>
            <option value="">Select employee</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name} · {o.employeeCode}</option>
            ))}
          </select>
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Base salary *"><input value={base} onChange={(e) => setBase(e.target.value)} type="number" min="0" placeholder="30000" className={inputCls} /></Field>
          <Field label="Allowed holidays/mo"><input value={holidays} onChange={(e) => setHolidays(e.target.value)} type="number" min="0" className={inputCls} /></Field>
          <Field label="HRA"><input value={hra} onChange={(e) => setHra(e.target.value)} type="number" min="0" className={inputCls} /></Field>
          <Field label="Travel"><input value={travel} onChange={(e) => setTravel(e.target.value)} type="number" min="0" className={inputCls} /></Field>
          <Field label="Special"><input value={special} onChange={(e) => setSpecial(e.target.value)} type="number" min="0" className={inputCls} /></Field>
          <Field label="PF deduction"><input value={pf} onChange={(e) => setPf(e.target.value)} type="number" min="0" className={inputCls} /></Field>
          <Field label="Other deductions"><input value={other} onChange={(e) => setOther(e.target.value)} type="number" min="0" className={inputCls} /></Field>
        </div>

        {error && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="agent-press mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--brand-emerald)" }}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Saving..." : "Save settings"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--brand-ink)]/70">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--brand-ink)]/55">{label}</span>
      <span className="font-medium tabular-nums">₹{value.toLocaleString("en-IN")}</span>
    </div>
  );
}

function statusStyle(status: string): { background: string; color: string } {
  if (status === "PAID") {
    return {
      background: "color-mix(in srgb, var(--brand-checkin) 12%, white)",
      color: "var(--brand-checkin)",
    };
  }
  if (status === "APPROVED") {
    return {
      background: "color-mix(in srgb, var(--brand-gold) 15%, white)",
      color: "#8a6d24",
    };
  }
  return {
    background: "rgba(0,0,0,0.05)",
    color: "rgba(0,0,0,0.45)",
  };
}
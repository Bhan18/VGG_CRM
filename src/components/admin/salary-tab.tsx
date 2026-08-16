"use client";

// Admin salary — per-employee salary settings + computed monthly records.

import { Banknote, User } from "lucide-react";
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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function SalaryTab() {
  const { data, loading, error, reload } = useAdminFetch<SalaryData>(
    "/api/attendance/admin/salary",
  );

  if (loading && !data) return <SkeletonList count={6} height={72} />;
  if (error && !data) {
    return <ErrorState title="Couldn't load salary" description={error} onRetry={reload} />;
  }
  if (!data) return <EmptyState icon={Banknote} title="No salary data" />;

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold text-[var(--brand-ink)]/70">
          Salary settings
        </h3>
        {data.settings.length === 0 ? (
          <EmptyState
            icon={User}
            title="No salary settings"
            description="Set base salary + allowances for employees from the dashboard."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.settings.map((s) => {
              const total =
                s.base_salary +
                s.hra_allowance +
                s.travel_allowance +
                s.special_allowance;
              const deductions = s.pf_deduction + s.other_deduction;
              const net = total - deductions;
              return (
                <div key={s.id} className="agent-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{s.employee.name}</div>
                      <div className="truncate text-[10px] text-[var(--brand-ink)]/55">
                        {s.employee.department} · {s.employee.employee_code}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold tabular-nums">
                        ₹{net.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-[var(--brand-ink)]/50">net / month</div>
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

      <section>
        <h3 className="mb-2 text-xs font-semibold text-[var(--brand-ink)]/70">
          Computed salary records
        </h3>
        {data.records.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No computed records"
            description="Salary records appear here once they are calculated."
          />
        ) : (
          <div className="agent-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/50">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="px-2 py-2 font-medium">Month</th>
                    <th className="px-2 py-2 font-medium">Present</th>
                    <th className="px-2 py-2 font-medium">Late</th>
                    <th className="px-2 py-2 font-medium">Half</th>
                    <th className="px-2 py-2 font-medium">Absent</th>
                    <th className="px-2 py-2 text-right font-medium">Gross</th>
                    <th className="px-2 py-2 text-right font-medium">Net</th>
                    <th className="px-4 py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, transparent)" }}>
                      <td className="px-4 py-2.5 font-medium">{r.employee.name}</td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {MONTHS[r.month - 1]} {r.year}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">{r.present_days}</td>
                      <td className="px-2 py-2.5 tabular-nums">{r.late_days}</td>
                      <td className="px-2 py-2.5 tabular-nums">{r.half_days}</td>
                      <td className="px-2 py-2.5 tabular-nums">{r.absent_days}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">₹{r.gross_salary.toLocaleString("en-IN")}</td>
                      <td className="px-2 py-2.5 text-right font-medium tabular-nums">₹{r.net_salary.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium"
                          style={statusStyle(r.status)}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
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

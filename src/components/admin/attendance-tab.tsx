"use client";

// Admin attendance — searchable list of all attendance records.

import { useState } from "react";
import { CalendarCheck2, Search } from "lucide-react";
import { useAdminFetch } from "@/hooks/admin/use-admin-data";
import {
  SkeletonList,
  EmptyState,
  ErrorState,
  StatusPill,
} from "@/components/agent/ui-primitives";

type AdminRecord = {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  working_minutes: number | null;
  status: string;
  check_in_reason: string | null;
  check_out_reason: string | null;
  attendance_employees: {
    id: string;
    employee_code: string;
    name: string;
    department: string;
    role: string;
    phone: string;
  };
};

type RecordsData = {
  records: AdminRecord[];
  count: number;
  page: number;
};

const STATUSES = [
  "PRESENT",
  "LATE",
  "HALF_DAY",
  "ABSENT",
  "ON_LEAVE",
  "CANCELLED",
];

export function AttendanceTab() {
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (employeeId) params.set("employeeId", employeeId);
  if (status) params.set("status", status);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  params.set("page", String(page));
  params.set("pageSize", "50");

  const { data, loading, error, reload } = useAdminFetch<RecordsData>(
    `/api/attendance/admin/records?${params.toString()}`,
    [employeeId, status, dateFrom, dateTo, page],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={employeeId}
          onChange={(e) => {
            setEmployeeId(e.target.value);
            setPage(1);
          }}
          placeholder="Employee code"
          className="rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        />
      </div>

      {loading && !data && <SkeletonList count={8} height={56} />}
      {error && !data && <ErrorState title="Couldn't load records" description={error} onRetry={reload} />}
      {!loading && data && data.records.length === 0 && (
        <EmptyState
          icon={CalendarCheck2}
          title="No records match"
          description="Try adjusting the filters."
        />
      )}
      {data && data.records.length > 0 && (
        <>
          <div className="agent-card overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3 text-xs font-semibold" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, transparent)" }}>
              <span className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" style={{ color: "var(--brand-emerald)" }} />
                {data.count} records
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/50">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Check-in</th>
                    <th className="px-2 py-2 font-medium">Check-out</th>
                    <th className="px-2 py-2 font-medium">Hours</th>
                    <th className="px-2 py-2 font-medium">Reason</th>
                    <th className="px-4 py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, transparent)" }}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.attendance_employees.name}</div>
                        <div className="text-[10px] text-[var(--brand-ink)]/55">
                          {r.attendance_employees.department}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">{formatDate(r.attendance_date)}</td>
                      <td className="px-2 py-2.5 tabular-nums">{formatTime(r.check_in_time)}</td>
                      <td className="px-2 py-2.5 tabular-nums">{formatTime(r.check_out_time)}</td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {r.working_minutes != null ? formatMinutes(r.working_minutes) : "—"}
                      </td>
                      <td className="max-w-[140px] truncate px-2 py-2.5 text-[var(--brand-ink)]/60">
                        {r.check_in_reason || r.check_out_reason || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <StatusPill status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.count > 50 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                style={{ border: "1px solid color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
              >
                Previous
              </button>
              <span className="text-xs tabular-nums text-[var(--brand-ink)]/60">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.count <= page * 50}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                style={{ border: "1px solid color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(d: string): string {
  if (!d) return "—";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min}m`;
}

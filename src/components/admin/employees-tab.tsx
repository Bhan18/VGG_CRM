"use client";

// Admin employees — track every staff member and their status today.

import { useMemo, useState } from "react";
import { Users, Search } from "lucide-react";
import { useAdminFetch } from "@/hooks/admin/use-admin-data";
import {
  SkeletonList,
  EmptyState,
  ErrorState,
  StatusPill,
} from "@/components/agent/ui-primitives";

type EmployeeToday = {
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInPhoto: string | null;
};

type AdminEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  department: string;
  role: string;
  status: string;
  today: EmployeeToday | null;
};

type EmployeesData = {
  employees: AdminEmployee[];
  date: string;
};

export function EmployeesTab() {
  const { data, loading, error, reload } = useAdminFetch<EmployeesData>(
    "/api/attendance/admin/employees",
  );
  const [search, setSearch] = useState("");

  const departments = useMemo(
    () => [...new Set((data?.employees ?? []).map((e) => e.department))].sort(),
    [data],
  );
  const [dept, setDept] = useState("");

  const filtered = useMemo(() => {
    let list = data?.employees ?? [];
    if (dept) list = list.filter((e) => e.department === dept);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, search, dept]);

  if (loading && !data) return <SkeletonList count={8} height={64} />;
  if (error && !data) {
    return <ErrorState title="Couldn't load employees" description={error} onRetry={reload} />;
  }
  if (!data) return <EmptyState icon={Users} title="No employees" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--brand-ink)/40" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or code"
            className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--brand-emerald)]"
            style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          />
        </div>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No employees match" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <div key={e.id} className="agent-card flex items-center gap-3 p-3.5">
              {e.today?.checkInPhoto ? (
                <img
                  src={e.today.checkInPhoto}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: "var(--brand-emerald)" }}
                >
                  {initials(e.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{e.name}</span>
                  {e.role === "ADMIN" && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                      style={{
                        background: "color-mix(in srgb, var(--brand-gold) 20%, white)",
                        color: "#8a6d24",
                      }}
                    >
                      Admin
                    </span>
                  )}
                </div>
                <div className="truncate text-[10px] text-[var(--brand-ink)]/55">
                  {e.department} · {e.employeeCode}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {e.today ? (
                    <>
                      <StatusPill status={e.today.status} />
                      <span className="text-[10px] tabular-nums text-[var(--brand-ink)]/60">
                        in {formatTime(e.today.checkInTime)}
                      </span>
                    </>
                  ) : (
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium"
                      style={{
                        background: "color-mix(in srgb, var(--brand-checkout) 8%, white)",
                        color: "var(--brand-checkout)",
                      }}
                    >
                      No record today
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

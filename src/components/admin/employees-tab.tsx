"use client";

// Admin employees — track every staff member and their status today.
// Includes MPIN management (set / reset) per employee.

import { useMemo, useState } from "react";
import { Users, Search, KeyRound, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  hasMpin: boolean;
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
  const [mpinEmployee, setMpinEmployee] = useState<AdminEmployee | null>(null);

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
                  {e.department} / {e.employeeCode}
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
              <button
                onClick={() => setMpinEmployee(e)}
                className="agent-press shrink-0 rounded-lg p-2 text-[var(--brand-emerald)] hover:bg-[color-mix(in_srgb,var(--brand-emerald) 8%,white)]"
                title={e.hasMpin ? "Reset MPIN" : "Set MPIN"}
              >
                <KeyRound className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {mpinEmployee && (
        <SetMpinDialog
          employee={mpinEmployee}
          onClose={() => setMpinEmployee(null)}
          onDone={() => {
            setMpinEmployee(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function SetMpinDialog({
  employee,
  onClose,
  onDone,
}: {
  employee: AdminEmployee;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mpin, setMpin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!/^\d{4}$/.test(mpin)) {
      setError("MPIN must be exactly 4 digits.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/admin/set-mpin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id, mpin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not set MPIN.");
        return;
      }
      toast.success("MPIN set", {
        description: `${employee.name} can now log in with MPIN ${mpin}.`,
      });
      onDone();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
            <div className="text-sm font-semibold">
              {employee.hasMpin ? "Reset MPIN" : "Set MPIN"}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1 text-xs text-[var(--brand-ink)]/55">
          {employee.name} ({employee.employeeCode})
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">
              4-digit MPIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={mpin}
              onChange={(e) => setMpin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={busy}
              autoFocus
              className="w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-center text-lg font-semibold tracking-[0.3em] outline-none focus:border-[var(--brand-emerald)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-emerald)_20%,transparent)]"
              placeholder="----"
            />
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="agent-press flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--brand-emerald)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {busy ? "Saving..." : employee.hasMpin ? "Reset MPIN" : "Set MPIN"}
          </button>
        </form>
      </div>
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "---";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "---";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

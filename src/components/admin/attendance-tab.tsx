"use client";

// Admin attendance dashboard.
//   - "Month" view (default): every employee on one screen with a monthly
//     heatmap calendar, attendance pacing, rate ring and per-day detail.
//   - "Day" view: the raw day-by-day records table with filters + photos.
// Backed by /api/attendance/admin/monthly and /api/attendance/admin/records.

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  Search,
  Camera,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CalendarDays,
  List,
  UserCheck,
  Clock3,
  Coffee,
  Plane,
  UserX,
  Activity,
  AlertTriangle,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminFetch } from "@/hooks/admin/use-admin-data";
import {
  SkeletonList,
  EmptyState,
  ErrorState,
  StatusPill,
} from "@/components/agent/ui-primitives";
import { ConfirmSheet } from "./employees-tab";

// ─── Types ───────────────────────────────────────────────────────────────

type MonthlyDay = {
  id: string | null;
  date: string;
  weekday: number;
  status: string | null;
  checkIn: string | null;
  checkOut: string | null;
  workingMinutes: number | null;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  reason: string | null;
  isWeekend: boolean;
  inFuture: boolean;
};

type MonthlyEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  role: string;
  profilePhoto: string | null;
  present: number;
  late: number;
  halfDay: number;
  onLeave: number;
  cancelled: number;
  absent: number;
  workingDaysElapsed: number;
  attendanceRate: number;
  totalMinutes: number;
  days: MonthlyDay[];
};

type MonthlyReport = {
  month: string;
  timezone: string;
  departments: string[];
  totals: {
    employees: number;
    workingDaysElapsed: number;
    present: number;
    late: number;
    halfDay: number;
    onLeave: number;
    absent: number;
    cancelled: number;
    attendanceRate: number;
  };
  employees: MonthlyEmployee[];
};

type DayRecord = {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_photo: string | null;
  check_out_photo: string | null;
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
  records: DayRecord[];
  count: number;
  page: number;
};

const STATUS_ORDER = ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "ON_LEAVE", "CANCELLED"];

// Cell colors for the monthly heatmap.
function statusColor(status: string | null): string {
  switch (status) {
    case "PRESENT": return "var(--brand-emerald)";
    case "LATE": return "#d97706";
    case "HALF_DAY": return "#ea580c";
    case "ON_LEAVE": return "var(--brand-gold)";
    case "CANCELLED": return "#9ca3af";
    case "ABSENT": return "var(--brand-checkout)";
    default: return "#e8e5db";
  }
}

// ─── Tab ─────────────────────────────────────────────────────────────────

export function AttendanceTab() {
  const [view, setView] = useState<"month" | "day">("month");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-[color-mix(in_srgb,var(--brand-emerald)_7%,white)] p-1">
          {([
            { id: "month", label: "Month", icon: CalendarDays },
            { id: "day", label: "Day", icon: List },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className="agent-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background: view === id ? "var(--brand-emerald)" : "transparent",
                color: view === id ? "#fff" : "var(--brand-ink)",
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "month" ? <MonthlyView /> : <DayRecordsView />}
    </div>
  );
}

// ─── Month view ──────────────────────────────────────────────────────────

function MonthlyView() {
  const [month, setMonth] = useState(currentMonthStr());
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "rate" | "absent" | "present">("name");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recordDialog, setRecordDialog] = useState<RecordDialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const params = new URLSearchParams({ month });
  if (department) params.set("department", department);

  const { data, loading, error, reload } = useAdminFetch<MonthlyReport>(
    `/api/attendance/admin/monthly?${params.toString()}`,
    [month, department],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? (data?.employees ?? []).filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.employeeCode.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q),
        )
      : (data?.employees ?? []);
    const sorted = [...list];
    switch (sort) {
      case "rate":
        sorted.sort((a, b) => a.attendanceRate - b.attendanceRate || b.absent - a.absent);
        break;
      case "absent":
        sorted.sort((a, b) => b.absent - a.absent || a.attendanceRate - b.attendanceRate);
        break;
      case "present":
        sorted.sort((a, b) => b.present - a.present || a.attendanceRate - b.attendanceRate);
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [data, search, sort]);

  const canGoNext = month < currentMonthStr();
  const selected = data?.employees.find((e) => e.id === selectedId) ?? null;

  async function confirmDeleteRecord() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/attendance/admin/records?id=${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not delete record.");
        return;
      }
      toast.success("Record deleted");
      setDeleteTarget(null);
      reload();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="agent-press flex h-9 w-9 items-center justify-center rounded-xl border bg-white"
            style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[130px] px-2 text-center">
            <div className="text-sm font-semibold leading-tight">{monthLabel(month)}</div>
            <div className="text-[10px] text-[var(--brand-ink)]/50">
              {data ? `${data.totals.workingDaysElapsed} working days` : "loading…"}
            </div>
          </div>
          <button
            aria-label="Next month"
            onClick={() => canGoNext && setMonth(shiftMonth(month, 1))}
            disabled={!canGoNext}
            className="agent-press flex h-9 w-9 items-center justify-center rounded-xl border bg-white disabled:opacity-35"
            style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setRecordDialog({ mode: "add" })}
            className="agent-press flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
            style={{ background: "var(--brand-emerald)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
          <button
            onClick={() => setMonth(currentMonthStr())}
            className="agent-press rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ background: "color-mix(in srgb, var(--brand-emerald) 10%, white)", color: "var(--brand-emerald)" }}
          >
            Today
          </button>
          <button
            onClick={reload}
            aria-label="Refresh"
            className="agent-press flex h-9 w-9 items-center justify-center rounded-xl border bg-white"
            style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} style={{ color: loading ? "var(--brand-emerald)" : "var(--brand-ink)" }} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {!loading && data && <StatsStrip totals={data.totals} />}

      {/* Legend + note */}
      <div className="flex items-center justify-between text-[10px] text-[var(--brand-ink)]/55">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-[3px]" style={{ background: statusColor(s) }} />
              {s.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      {/* Controls */}
      <Controls
        search={search}
        setSearch={setSearch}
        departments={data?.departments ?? []}
        department={department}
        setDepartment={setDepartment}
        sort={sort}
        setSort={setSort}
      />

      {loading && !data && <SkeletonList count={6} height={180} />}
      {error && !data && <ErrorState title="Couldn't load the attendance report" description={error} onRetry={reload} />}
      {!loading && data && filtered.length === 0 && (
        <EmptyState icon={CalendarCheck2} title="No employees match" description="Try clearing the search or department filter." />
      )}

      {!loading && data && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <EmployeeCard key={e.id} employee={e} onOpen={() => setSelectedId(e.id)} />
          ))}
        </div>
      )}

      {selected && (
        <DetailSheet
          employee={selected}
          monthLabel={monthLabel(month)}
          onClose={() => setSelectedId(null)}
          onEditDay={(day) =>
            setRecordDialog({
              mode: "edit",
              record: {
                id: day.id!,
                date: day.date,
                checkIn: day.checkIn,
                checkOut: day.checkOut,
                status: day.status ?? "PRESENT",
                employeeId: selected.id,
                employeeName: selected.name,
              },
            })
          }
          onDeleteDay={(day) =>
            day.id && setDeleteTarget({ id: day.id, label: `${selected.name} · ${fmtDate(day.date)}` })
          }
          onAddDay={(day) =>
            setRecordDialog({
              mode: "add",
              record: {
                id: null,
                date: day.date,
                checkIn: null,
                checkOut: null,
                status: "PRESENT",
                employeeId: selected.id,
                employeeName: selected.name,
              },
            })
          }
        />
      )}
      {recordDialog && (
        <RecordDialog dialog={recordDialog} onClose={() => setRecordDialog(null)} onSaved={() => { setRecordDialog(null); reload(); }} />
      )}
      {deleteTarget && (
        <ConfirmSheet
          title="Delete record?"
          body={`Delete the attendance record for ${deleteTarget.label}? This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteRecord}
        />
      )}
    </div>
  );
}

function StatsStrip({ totals }: { totals: MonthlyReport["totals"] }) {
  const stats = [
    { label: "Present", value: totals.present, icon: UserCheck, tint: "var(--brand-emerald)" },
    { label: "Late", value: totals.late, icon: Clock3, tint: "#d97706" },
    { label: "Half-day", value: totals.halfDay, icon: Coffee, tint: "#ea580c" },
    { label: "On leave", value: totals.onLeave, icon: Plane, tint: "var(--brand-gold)" },
    { label: "Absent", value: totals.absent, icon: UserX, tint: "var(--brand-checkout)" },
    { label: "Attendance", value: `${totals.attendanceRate}%`, icon: Activity, tint: "var(--brand-checkin)" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="agent-card px-3 py-3">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${s.tint} 12%, white)`, color: s.tint }}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="mt-2 text-lg font-semibold leading-none tabular-nums">{s.value}</div>
            <div className="mt-1 text-[10px] text-[var(--brand-ink)]/55">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function Controls({
  search,
  setSearch,
  departments,
  department,
  setDepartment,
  sort,
  setSort,
}: {
  search: string;
  setSearch: (v: string) => void;
  departments: string[];
  department: string;
  setDepartment: (v: string) => void;
  sort: string;
  setSort: (v: "name" | "rate" | "absent" | "present") => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--brand-ink)]/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, department"
            className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--brand-emerald)]"
            style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "name" | "rate" | "absent" | "present")}
          className="rounded-xl border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
          aria-label="Sort employees"
        >
          <option value="name">Sort: Name</option>
          <option value="rate">Attendance: good → bad</option>
          <option value="absent">Most absences</option>
          <option value="present">Most present</option>
        </select>
      </div>
      {departments.length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
          <DeptChip label="All" active={department === ""} onClick={() => setDepartment("")} />
          {departments.map((d) => (
            <DeptChip key={d} label={d} active={department === d} onClick={() => setDepartment(d)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeptChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="agent-press shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium"
      style={{
        borderColor: active ? "var(--brand-emerald)" : "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)",
        background: active ? "color-mix(in srgb, var(--brand-emerald) 10%, white)" : "#fff",
        color: active ? "var(--brand-emerald)" : "var(--brand-ink)",
      }}
    >
      {label}
    </button>
  );
}

// ─── Employee card ───────────────────────────────────────────────────────

function EmployeeCard({ employee: e, onOpen }: { employee: MonthlyEmployee; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="agent-card agent-press flex flex-col gap-2.5 p-3 text-left">
      <div className="flex items-center gap-2.5">
        {e.profilePhoto ? (
          <img src={e.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: "var(--brand-emerald)" }}
          >
            {initials(e.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold">{e.name}</span>
            {e.department && (
              <span
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium"
                style={{ background: "color-mix(in srgb, var(--brand-emerald) 10%, white)", color: "var(--brand-emerald)" }}
              >
                {e.department}
              </span>
            )}
          </div>
          <div className="text-[10px] text-[var(--brand-ink)]/50">{e.employeeCode}</div>
        </div>
        <RateRing value={e.attendanceRate} />
      </div>

      <MiniCal employee={e} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[10px]" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, transparent)" }}>
        <CountDot color="var(--brand-emerald)" n={e.present} label="Present" />
        <CountDot color="#d97706" n={e.late} label="Late" />
        <CountDot color="#ea580c" n={e.halfDay} label="Half" />
        <CountDot color="var(--brand-gold)" n={e.onLeave} label="Leave" />
        <CountDot color="var(--brand-checkout)" n={e.absent} label="Absent" />
        <span className="ml-auto tabular-nums text-[var(--brand-ink)]/45">
          {formatMinutes(e.totalMinutes)} worked
        </span>
      </div>
    </button>
  );
}

function CountDot({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <span className="flex items-center gap-1 font-medium tabular-nums text-[var(--brand-ink)]/65">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {n}
      <span className="font-normal text-[var(--brand-ink)]/40">{label}</span>
    </span>
  );
}

function RateRing({ value }: { value: number }) {
  const r = 15.2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const color = value >= 90 ? "var(--brand-emerald)" : value >= 70 ? "#d97706" : "var(--brand-checkout)";
  return (
    <div
      className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center"
      title={`${value}% attendance`}
    >
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#efece2" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[7px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

function MiniCal({ employee: e }: { employee: MonthlyEmployee }) {
  const firstDate = e.days[0];
  const startWeekday = firstDate ? new Date(`${firstDate.date}T00:00:00`).getDay() : 0;
  const cells: { day: MonthlyDay | null; key: string }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, key: `pad-${i}` });
  for (const d of e.days) cells.push({ day: d, key: d.date });

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[8px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]/35">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ day, key }) => {
          if (!day) return <span key={key} />;
          let bg = "";
          if (day.isWeekend) bg = "#f3f0e7";
          else if (day.inFuture) bg = "transparent";
          else if (day.status) bg = statusColor(day.status);
          else bg = statusColor("ABSENT");
          const title = tooltipFor(day);
          return (
            <span
              key={key}
              className="flex h-3.5 items-center justify-center rounded-[3px]"
              style={{
                background: bg,
                boxShadow: day.inFuture ? "inset 0 0 0 1px rgba(0,0,0,0.06)" : undefined,
              }}
              title={title}
            />
          );
        })}
      </div>
    </div>
  );
}

function tooltipFor(d: MonthlyDay): string {
  const dateLabel = fmtDate(d.date);
  if (d.isWeekend) return `${dateLabel} · Weekend`;
  if (d.inFuture) return `${dateLabel} · Upcoming`;
  if (!d.status) return `${dateLabel} · Absent`;
  const times = `${fmtTime(d.checkIn)} → ${fmtTime(d.checkOut)}`;
  const hrs = d.workingMinutes != null ? ` · ${formatMinutes(d.workingMinutes)}` : "";
  const missing = d.checkIn && !d.checkOut ? " · no check-out" : "";
  return `${dateLabel} · ${d.status.replace("_", " ")} · ${times}${hrs}${missing}`;
}

// ─── Detail sheet ────────────────────────────────────────────────────────

function DetailSheet({
  employee: e,
  monthLabel,
  onClose,
  onEditDay,
  onDeleteDay,
  onAddDay,
}: {
  employee: MonthlyEmployee;
  monthLabel: string;
  onClose: () => void;
  onEditDay: (day: MonthlyDay) => void;
  onDeleteDay: (day: MonthlyDay) => void;
  onAddDay: (day: MonthlyDay) => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Days worth showing: every elapsed (non-weekend) day, with absent days
  // highlighted. Newest first.
  const rows = e.days
    .filter((d) => !d.isWeekend && !d.inFuture)
    .map((d) => ({ ...d, absent: !d.status }))
    .reverse();

  const attended = e.present + e.late + e.halfDay;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
        <button onClick={onClose} className="agent-press rounded-lg p-1.5 text-[var(--brand-ink)]" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {e.profilePhoto ? (
              <img src={e.profilePhoto} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: "var(--brand-emerald)" }}>
                {initials(e.name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{e.name}</div>
              <div className="truncate text-[10px] text-[var(--brand-ink)]/50">
                {e.employeeCode} · {e.department}
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--brand-ink)]/45">{monthLabel}</div>
          <div className="text-sm font-semibold tabular-nums" style={{ color: e.attendanceRate >= 70 ? "var(--brand-emerald)" : "var(--brand-checkout)" }}>
            {attended}/{e.workingDaysElapsed} days
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mb-3 flex flex-wrap gap-2">
          <DaySummaryChip color="var(--brand-emerald)" label="Present" value={e.present} />
          <DaySummaryChip color="#d97706" label="Late" value={e.late} />
          <DaySummaryChip color="#ea580c" label="Half-day" value={e.halfDay} />
          <DaySummaryChip color="var(--brand-gold)" label="On leave" value={e.onLeave} />
          <DaySummaryChip color="var(--brand-checkout)" label="Absent" value={e.absent} />
          <DaySummaryChip color="#9ca3af" label="Cancelled" value={e.cancelled} />
        </div>

        <div className="flex flex-col gap-1.5">
          {rows.map((d) => (
            <DayRow
              key={d.date}
              day={d}
              onEdit={d.status ? () => onEditDay(d) : undefined}
              onDelete={d.status && d.id ? () => onDeleteDay(d) : undefined}
              onAdd={!d.status ? () => onAddDay(d) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DaySummaryChip({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
      style={{ background: `color-mix(in srgb, ${color} 8%, white)`, color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function DayRow({
  day,
  onEdit,
  onDelete,
  onAdd,
}: {
  day: MonthlyDay & { absent: boolean };
  onEdit?: () => void;
  onDelete?: () => void;
  onAdd?: () => void;
}) {
  const dt = new Date(`${day.date}T00:00:00`);
  // Past day with a check-in but no check-out → auto-closed as half-day.
  const missingCheckout = !!day.checkIn && !day.checkOut && day.date < todayStr();
  return (
    <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
      <div className="w-11 flex-shrink-0 text-center">
        <div className="text-sm font-semibold tabular-nums">{dt.getDate()}</div>
        <div className="text-[9px] uppercase text-[var(--brand-ink)]/45">
          {dt.toLocaleDateString("en-IN", { month: "short" })}
        </div>
        <div className="text-[9px] text-[var(--brand-ink)]/35">
          {dt.toLocaleDateString("en-IN", { weekday: "short" })}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <StatusPill status={day.status ?? "ABSENT"} />
        {day.status ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums text-[var(--brand-ink)]/70">
            <span className="flex items-center gap-1"><Clock3 className="h-3 w-3 text-[var(--brand-ink)]/35" />{fmtTime(day.checkIn)} → {fmtTime(day.checkOut)}</span>
            {day.workingMinutes != null && <span>{formatMinutes(day.workingMinutes)}</span>}
            {day.reason && <span className="w-full truncate text-[10px] text-[var(--brand-ink)]/50">“{day.reason}”</span>}
            {missingCheckout && (
              <span className="flex w-full items-center gap-1 text-[10px] font-medium" style={{ color: "#d97706" }}>
                <AlertTriangle className="h-3 w-3" /> Check-out missing — counted as half-day
              </span>
            )}
          </div>
        ) : (
          <div className="mt-1 text-[10px] text-[var(--brand-ink)]/45">No record</div>
        )}
      </div>

      {(day.checkInPhoto || day.checkOutPhoto) && (
        <div className="flex flex-shrink-0 gap-1.5">
          {day.checkInPhoto && <PhotoThumb path={day.checkInPhoto} label="In" />}
          {day.checkOutPhoto && <PhotoThumb path={day.checkOutPhoto} label="Out" />}
        </div>
      )}

      <div className="flex flex-shrink-0 items-center gap-1">
        {onAdd && (
          <button
            onClick={onAdd}
            title="Add record for this day"
            className="agent-press flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "color-mix(in srgb, var(--brand-emerald) 10%, white)", color: "var(--brand-emerald)" }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            title="Edit record"
            className="agent-press flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 text-black/60"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            title="Delete record"
            className="agent-press flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Record add / edit dialog ────────────────────────────────────────────

type RecordDialogState = {
  mode: "add" | "edit";
  record?: {
    id: string | null;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    employeeId?: string;
    employeeName?: string;
  };
};

function useEmployeeOptions() {
  const { data } = useAdminFetch<{
    employees: { id: string; employeeCode: string; name: string }[];
  }>("/api/attendance/admin/employees");
  return data?.employees ?? [];
}

function RecordDialog({
  dialog,
  onClose,
  onSaved,
}: {
  dialog: RecordDialogState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const employees = useEmployeeOptions();
  const preset = dialog.record;
  const [employeeId, setEmployeeId] = useState(preset?.employeeId ?? "");
  const [date, setDate] = useState(preset?.date ?? todayStr());
  const [checkIn, setCheckIn] = useState(isoToLocalInput(preset?.checkIn ?? null));
  const [checkOut, setCheckOut] = useState(isoToLocalInput(preset?.checkOut ?? null));
  const [status, setStatus] = useState(dialog.mode === "edit" ? (preset?.status ?? "AUTO") : "AUTO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needPicker = dialog.mode === "add" && !preset?.employeeId;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const empId = preset?.employeeId ?? employeeId;
    if (!empId) {
      setError("Select an employee.");
      return;
    }
    if (!date) {
      setError("Select a date.");
      return;
    }
    const inIso = localInputToIso(checkIn);
    const outIso = localInputToIso(checkOut);
    if (checkIn && !inIso) {
      setError("Invalid check-in time.");
      return;
    }
    if (checkOut && !outIso) {
      setError("Invalid check-out time.");
      return;
    }
    setBusy(true);
    try {
      const url = "/api/attendance/admin/records";
      const res = await fetch(url, {
        method: dialog.mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          dialog.mode === "add"
            ? {
                employeeId: empId,
                date,
                checkIn: inIso,
                checkOut: outIso,
                ...(status !== "AUTO" ? { status } : {}),
              }
            : {
                id: preset!.id,
                attendanceDate: date,
                checkInTime: inIso,
                checkOutTime: outIso,
                ...(status !== "AUTO" && status !== preset?.status ? { status } : {}),
              },
        ),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error ?? "Could not save record.");
        return;
      }
      toast.success(dialog.mode === "add" ? "Record added" : "Record updated");
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
        className="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">
            {dialog.mode === "add" ? "Add attendance record" : "Edit attendance record"}
            {preset?.employeeName && (
              <span className="ml-1 font-normal text-[var(--brand-ink)]/55">· {preset.employeeName}</span>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {needPicker && (
          <div className="mb-3 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">Employee *</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={dialogInputCls}>
              <option value="">Select employee</option>
              {employees.map((o) => (
                <option key={o.id} value={o.id}>{o.name} · {o.employeeCode}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">Date *</label>
            <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className={dialogInputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={dialogInputCls}>
              <option value="AUTO">{dialog.mode === "add" ? "Auto (from times)" : "Keep / auto"}</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">Check-in</label>
            <input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={dialogInputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--brand-ink)]/70">Check-out</label>
            <input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={dialogInputCls} />
          </div>
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
          {busy ? "Saving..." : dialog.mode === "add" ? "Add record" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

const dialogInputCls =
  "w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]";

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── Day view (raw records table) ────────────────────────────────────────

function DayRecordsView() {
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [recordDialog, setRecordDialog] = useState<RecordDialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function confirmDeleteRecord() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/attendance/admin/records?id=${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not delete record.");
        return;
      }
      toast.success("Record deleted");
      setDeleteTarget(null);
      reload();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setRecordDialog({ mode: "add" })}
          className="agent-press flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--brand-emerald)" }}
        >
          <Plus className="h-3.5 w-3.5" /> Add record
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={employeeId}
          onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}
          placeholder="Employee code"
          className="rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:border-[var(--brand-emerald)]"
          style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        />
      </div>

      {loading && !data && <SkeletonList count={8} height={56} />}
      {error && !data && <ErrorState title="Couldn't load records" description={error} onRetry={reload} />}
      {!loading && data && data.records.length === 0 && (
        <EmptyState icon={CalendarCheck2} title="No records match" description="Try adjusting the filters." />
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
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/50">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Check-in</th>
                    <th className="px-2 py-2 font-medium">Check-out</th>
                    <th className="px-2 py-2 font-medium">Hours</th>
                    <th className="px-2 py-2 font-medium">Reason</th>
                    <th className="px-2 py-2 font-medium">Photos</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 8%, transparent)" }}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.attendance_employees.name}</div>
                        <div className="text-[10px] text-[var(--brand-ink)]/55">{r.attendance_employees.department}</div>
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">{fmtDate(r.attendance_date)}</td>
                      <td className="px-2 py-2.5 tabular-nums">{fmtTime(r.check_in_time)}</td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {r.check_out_time ? (
                          fmtTime(r.check_out_time)
                        ) : r.check_in_time && r.attendance_date.slice(0, 10) < todayStr() ? (
                          <span className="inline-flex items-center gap-1" style={{ color: "#d97706" }} title="Check-out missing — counted as half-day">
                            — <AlertTriangle className="h-3 w-3" />
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {r.working_minutes != null ? formatMinutes(r.working_minutes) : "—"}
                      </td>
                      <td className="max-w-[140px] truncate px-2 py-2.5 text-[var(--brand-ink)]/60">
                        {r.check_in_reason || r.check_out_reason || "—"}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {r.check_in_photo ? <PhotoThumb path={r.check_in_photo} label="In" /> : <span className="text-[var(--brand-ink)]/30">—</span>}
                          {r.check_out_photo ? <PhotoThumb path={r.check_out_photo} label="Out" /> : <span className="text-[var(--brand-ink)]/30">—</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right"><StatusPill status={r.status} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              setRecordDialog({
                                mode: "edit",
                                record: {
                                  id: r.id,
                                  date: r.attendance_date.slice(0, 10),
                                  checkIn: r.check_in_time,
                                  checkOut: r.check_out_time,
                                  status: r.status,
                                  employeeId: r.attendance_employees.id,
                                  employeeName: r.attendance_employees.name,
                                },
                              })
                            }
                            title="Edit record"
                            className="agent-press flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 text-black/60"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                id: r.id,
                                label: `${r.attendance_employees.name} · ${fmtDate(r.attendance_date)}`,
                              })
                            }
                            title="Delete record"
                            className="agent-press flex h-7 w-7 items-center justify-center rounded-lg"
                            style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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

      {recordDialog && (
        <RecordDialog dialog={recordDialog} onClose={() => setRecordDialog(null)} onSaved={() => { setRecordDialog(null); reload(); }} />
      )}
      {deleteTarget && (
        <ConfirmSheet
          title="Delete record?"
          body={`Delete the attendance record for ${deleteTarget.label}? This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteRecord}
        />
      )}
    </div>
  );
}

// ─── Photo thumbnail ─────────────────────────────────────────────────────

function PhotoThumb({ path, label }: { path: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/attendance/photo-url?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((d) => { if (active && d.url) setSrc(d.url); })
      .catch(() => {});
    return () => { active = false; };
  }, [path]);

  return (
    <>
      <button
        onClick={() => src && setOpen(true)}
        className="agent-press relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-lg border"
        style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}
        title={`View ${label} photo`}
      >
        {src ? (
          <img src={src} alt={`${label} photo`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--brand-emerald)]/5">
            <Camera className="h-3 w-3 text-[var(--brand-emerald)]/40" />
          </div>
        )}
        <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-px py-px text-[7px] font-semibold text-white">{label}</span>
      </button>

      {open && src && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <img src={src} alt={`${label} photo`} className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-xl" />
        </div>
      )}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Local "YYYY-MM-DD" (device date — good enough for past-vs-today checks). */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function fmtDate(d: string): string {
  if (!d) return "—";
  const dt = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtTime(iso: string | null): string {
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

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
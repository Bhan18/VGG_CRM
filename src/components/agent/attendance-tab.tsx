"use client";

// Attendance view — today's status card (check-in / check-out) + history
// as a clean grouped timeline. Check-in/out go through the app's camera
// flow (owned by the page) so every action is photo-verified.

import { useEffect, useMemo, useState } from "react";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";
import { useAttendanceLog } from "@/hooks/agent/use-agent-data";
import { useOnline } from "@/hooks/use-online";
import {
  SkeletonList,
  EmptyState,
  ErrorState,
  StatusPill,
} from "@/components/agent/ui-primitives";
import {
  formatTime,
  formatDate,
  todayKey,
  workedDurationHours,
  formatDuration,
} from "@/lib/agent-format";
import {
  Camera,
  LogOut,
  MapPin,
  Clock,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentTodayRecord, AttendanceLogEntry } from "@/lib/agent/types";

interface AttendanceTabProps {
  onCheckIn: () => void;
  onCheckOut: () => void;
  busy?: boolean;
}

export function AttendanceTab({ onCheckIn, onCheckOut, busy }: AttendanceTabProps) {
  const { session } = useAgentAuth();
  const history = useAttendanceLog(14);
  const online = useOnline();

  const today = session?.today ?? null;
  const checkedIn = !!today?.checkInTime;
  const checkedOut = !!today?.checkOutTime;

  return (
    <div className="fade-in space-y-7 px-4 pb-6 pt-4">
      {/* Today's status card */}
      <section>
        <TodayCard
          today={today}
          checkedIn={checkedIn}
          checkedOut={checkedOut}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          busy={busy}
          online={online}
        />
      </section>

      {/* Monthly summary — minimal stat row */}
      <section>
        <MonthlyStats records={history.data ?? []} />
      </section>

      {/* History timeline */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            History
          </h2>
          {history.data && history.data.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {history.data.length} records
            </span>
          )}
        </div>
        {history.isLoading ? (
          <SkeletonList count={6} height={70} />
        ) : history.isError ? (
          <ErrorState onRetry={() => history.refetch()} />
        ) : !history.data || history.data.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No attendance yet"
            description="Your check-ins will appear here once you start marking attendance."
          />
        ) : (
          <HistoryTimeline records={history.data} />
        )}
      </section>
    </div>
  );
}

// ─── Today card ─────────────────────────────────────────────────────────────

function TodayCard({
  today,
  checkedIn,
  checkedOut,
  onCheckIn,
  onCheckOut,
  busy,
  online,
}: {
  today: AgentTodayRecord | null;
  checkedIn: boolean;
  checkedOut: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  busy?: boolean;
  online: boolean;
}) {
  const worked = workedDurationHours(today?.checkInTime, today?.checkOutTime);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div
        className={cn("p-5", !checkedIn && "text-white")}
        style={
          !checkedIn
            ? {
                background:
                  "linear-gradient(135deg, var(--brand-emerald) 0%, var(--brand-emerald-soft) 100%)",
              }
            : undefined
        }
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              className={cn(
                "text-[11px] font-medium uppercase tracking-wider",
                !checkedIn ? "text-white/60" : "text-muted-foreground",
              )}
            >
              {formatDate(todayKey())}
            </div>
            {!checkedIn ? (
              <>
                <div className="mt-1.5 text-2xl font-semibold">Ready to check in</div>
                <div className="mt-1 text-xs text-white/70">
                  Take a live selfie to begin your day.
                </div>
              </>
            ) : (
              <div className="mt-1.5 flex items-baseline gap-2.5">
                <span className="tnum text-2xl font-semibold">
                  {formatTime(today?.checkInTime)}
                </span>
                <StatusPill status={today?.status ?? "present"} />
              </div>
            )}
          </div>
          <div
            className={cn(
              "grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl",
              !checkedIn ? "bg-white/10 backdrop-blur" : "bg-primary/10",
            )}
          >
            <Clock className={cn("h-5 w-5", !checkedIn && "text-white")} />
          </div>
        </div>

        {checkedIn && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label="Check-in" value={formatTime(today?.checkInTime)} />
            <MiniStat
              label="Check-out"
              value={checkedOut ? formatTime(today?.checkOutTime) : "—"}
            />
          </div>
        )}

        {checkedIn && today?.checkInPhoto && (
          <div className="mt-3 flex items-center gap-2">
            <StaffPhotoThumb path={today.checkInPhoto} label="In" />
            {today?.checkOutPhoto && (
              <StaffPhotoThumb path={today.checkOutPhoto} label="Out" />
            )}
          </div>
        )}
      </div>

      {today?.checkInDistance != null && checkedIn && (
        <div className="flex items-center gap-1.5 border-t border-border/60 bg-muted/30 px-5 py-2.5 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {today.checkInDistance <= 5
            ? "At office"
            : `~${Math.round(today.checkInDistance)} m from office`}
          {today.checkInLatitude != null && today.checkInLongitude != null && (
            <span className="opacity-60">
              · {today.checkInLatitude.toFixed(3)}, {today.checkInLongitude.toFixed(3)}
            </span>
          )}
        </div>
      )}

      <div className="p-4">
        {!checkedIn ? (
          <Button
            onClick={onCheckIn}
            disabled={busy || !online}
            size="lg"
            className="h-12 w-full rounded-xl text-[15px] font-medium"
          >
            <Camera className="h-4 w-4" />
            {busy ? "Checking in…" : "Check in with selfie"}
          </Button>
        ) : !checkedOut ? (
          <Button
            onClick={onCheckOut}
            disabled={busy || !online}
            size="lg"
            variant="destructive"
            className="h-12 w-full rounded-xl text-[15px] font-medium"
          >
            <LogOut className="h-4 w-4" />
            {busy ? "Checking out…" : "Check out"}
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Day complete
            {worked != null && (
              <span className="font-normal text-muted-foreground">
                · {formatDuration(Math.round(worked * 60))}
              </span>
            )}
          </div>
        )}
        {!online && (
          <p className="mt-2 text-center text-[11px] text-amber-600 dark:text-amber-400">
            You&apos;re offline — reconnect to mark attendance.
          </p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/50 px-3 py-2 dark:bg-white/5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="tnum mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

// ─── Staff photo thumbnail ───────────────────────────────────────────────────

function StaffPhotoThumb({ path, label }: { path: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/attendance/photo-url?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d.url) setSrc(d.url);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [path]);

  if (!src) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg border border-border/60"
        title={`${label} photo`}
      >
        <img src={src} alt={`${label} photo`} className="h-full w-full object-cover" />
        <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 py-px text-[8px] font-semibold text-white">
          {label}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt={`${label} photo`}
            className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-xl"
          />
        </div>
      )}
    </>
  );
}

// ─── Monthly stats row ──────────────────────────────────────────────────────

function MonthlyStats({ records }: { records: AttendanceLogEntry[] }) {
  const now = new Date();
  const monthRecords = records.filter((r) => {
    const d = new Date(`${r.attendanceDate}T00:00:00`);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const present = monthRecords.filter(
    (r) => r.status === "PRESENT" || r.status === "HALF_DAY",
  ).length;
  const late = monthRecords.filter((r) => r.status === "LATE").length;
  const absent = monthRecords.filter((r) => r.status === "ABSENT").length;

  const stats = [
    { label: "Present", value: present, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Late", value: late, color: "text-amber-600 dark:text-amber-400" },
    { label: "Absent", value: absent, color: "text-rose-600 dark:text-rose-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-border/60 bg-card px-3 py-3 text-center shadow-sm"
        >
          <div className={cn("tnum text-2xl font-semibold", s.color)}>{s.value}</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── History timeline (grouped by week) ─────────────────────────────────────

const DOT_COLOR: Record<AttendanceLogEntry["status"], string> = {
  PRESENT: "bg-emerald-500",
  LATE: "bg-amber-500",
  HALF_DAY: "bg-sky-500",
  ABSENT: "bg-rose-500",
  ON_LEAVE: "bg-sky-500",
  CANCELLED: "bg-neutral-400",
};

function HistoryTimeline({ records }: { records: AttendanceLogEntry[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, AttendanceLogEntry[]>();
    for (const r of records) {
      const d = new Date(`${r.attendanceDate}T00:00:00`);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [records]);

  return (
    <div className="space-y-5">
      {groups.map(([weekLabel, items]) => (
        <div key={weekLabel}>
          <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Week of {weekLabel}
          </div>
          <div className="relative pl-5">
            <div className="absolute bottom-1 left-[7px] top-1 w-px bg-border" />
            <div className="space-y-2.5">
              {items.map((r) => {
                const d = new Date(`${r.attendanceDate}T00:00:00`);
                const dayLabel = d.toLocaleDateString(undefined, { weekday: "short" });
                const dateLabel = d.toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                });
                return (
                  <div key={r.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[14px] top-3 h-3 w-3 rounded-full border-2 border-background",
                        DOT_COLOR[r.status] ?? "bg-neutral-400",
                      )}
                    />
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="flex gap-1">
                          {r.checkInPhoto ? (
                            <StaffPhotoThumb path={r.checkInPhoto} label="In" />
                          ) : null}
                          {r.checkOutPhoto ? (
                            <StaffPhotoThumb path={r.checkOutPhoto} label="Out" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{dayLabel}</span>
                            <span className="text-[11px] text-muted-foreground">{dateLabel}</span>
                            <StatusPill status={r.status} />
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                            {r.checkInTime ? (
                              <span className="tnum">In {formatTime(r.checkInTime)}</span>
                            ) : (
                              <span>—</span>
                            )}
                            {r.checkOutTime && (
                              <span className="tnum">Out {formatTime(r.checkOutTime)}</span>
                            )}
                            {r.workingMinutes != null && r.workingMinutes > 0 && (
                              <span className="text-muted-foreground/70">
                                {formatDuration(r.workingMinutes)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

/**
 * Attendance Overview view.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  CalendarClock,
  Plane,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatTime, photoUrl, statusColor } from "@/lib/attendance/format";
import type { AttendanceRecord, Overview } from "@/lib/attendance/types";
import { RecordDetailDialog } from "./RecordDetailDialog";

type OverviewProps = {
  onOpenRecord?: (record: AttendanceRecord) => void;
};

export function OverviewView({ onOpenRecord }: OverviewProps) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [today, setToday] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [ov, td] = await Promise.all([
      fetch("/api/attendance/overview").then((r) => r.json()),
      fetch("/api/attendance/today").then((r) => r.json()),
    ]);
    setOverview(ov);
    setToday(td.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const cards = overview
    ? [
        { label: "Total Staff", value: overview.totalStaff, icon: Users, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800/60" },
        { label: "Present", value: overview.present, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
        { label: "Late", value: overview.late, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/40" },
        { label: "Absent", value: overview.absent, icon: XCircle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-950/40" },
        { label: "Half Day", value: overview.halfDay, icon: CalendarClock, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-950/40" },
        { label: "On Leave", value: overview.onLeave, icon: Plane, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-950/40" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance Overview</h1>
        <p className="text-sm text-muted-foreground">
          Live snapshot of today&apos;s attendance across all departments.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {loading || !overview
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : cards.map((c) => (
              <Card key={c.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.bg}`}>
                    <c.icon className={`h-5 w-5 ${c.color}`} />
                  </div>
                  <div className="text-3xl font-semibold tabular-nums">{c.value}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
                    {c.label}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {overview && overview.byDepartment.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Department</CardTitle>
            <CardDescription>Attendance distribution per department today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {overview.byDepartment.map((d) => (
                <div key={d.department} className="rounded-lg border p-3 bg-card">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{d.department}</span>
                    <Badge variant="outline" className="tabular-nums">{d.total}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> {d.present}
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3" /> {d.late}
                    </span>
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                      <XCircle className="h-3 w-3" /> {d.absent}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Attendance</CardTitle>
          <CardDescription>Click any row to view check-in / check-out photos and GPS details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="w-16">Photo</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : today.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No attendance recorded today yet.
                        </TableCell>
                      </TableRow>
                    ) : today.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          if (onOpenRecord) onOpenRecord(r);
                          else setActiveRecord(r);
                        }}
                      >
                        <TableCell>
                          <div className="font-medium">{r.employee?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.employee?.employeeCode} · {r.employee?.department}
                          </div>
                        </TableCell>
                        <TableCell>
                          {photoUrl(r.checkInPhoto) ? (
                            <img
                              src={photoUrl(r.checkInPhoto)!}
                              alt="check-in"
                              className="h-8 w-8 rounded object-cover border"
                            />
                          ) : (
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-[10px]">
                                {(r.employee?.name ?? "?").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">{formatTime(r.checkInTime)}</TableCell>
                        <TableCell className="tabular-nums">{formatTime(r.checkOutTime)}</TableCell>
                        <TableCell className="tabular-nums">{formatDuration(r.workingMinutes)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColor(r.status)}>
                            {r.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RecordDetailDialog
        record={activeRecord}
        open={!!activeRecord}
        onOpenChange={(o) => !o && setActiveRecord(null)}
      />
    </div>
  );
}

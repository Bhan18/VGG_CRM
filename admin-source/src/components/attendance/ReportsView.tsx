"use client";

/**
 * Reports view — aggregate per-employee summary + CSV / XLSX export.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet } from "lucide-react";
import { formatDuration } from "@/lib/attendance/format";
import type { ReportRow } from "@/lib/attendance/types";

export function ReportsView() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  useEffect(() => {
    // Default to current month
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateFrom(first.toISOString().slice(0, 10));
    setDateTo(now.toISOString().slice(0, 10));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ dateFrom, dateTo });
    if (department !== "ALL") params.set("department", department);
    if (status !== "ALL") params.set("status", status);
    const res = await fetch(`/api/attendance/reports?${params}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setLoading(false);
  }, [dateFrom, dateTo, department, status]);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function exportFormat(fmt: "csv" | "xls") {
    const params = new URLSearchParams({ dateFrom, dateTo, format: fmt });
    if (department !== "ALL") params.set("department", department);
    if (status !== "ALL") params.set("status", status);
    window.location.href = `/api/attendance/export?${params.toString()}`;
  }

  const totals = rows.reduce(
    (acc, r) => ({
      workingDays: acc.workingDays + r.workingDays,
      present: acc.present + r.present,
      late: acc.late + r.late,
      halfDay: acc.halfDay + r.halfDay,
      onLeave: acc.onLeave + r.onLeave,
      minutes: acc.minutes + r.totalWorkingMinutes,
    }),
    { workingDays: 0, present: 0, late: 0, halfDay: 0, onLeave: 0, minutes: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Aggregate per-employee summary for a date range. Export to CSV or Excel-compatible XLS.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Department</label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="Construction">Construction</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="HALF_DAY">Half Day</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => exportFormat("csv")} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button onClick={() => exportFormat("xls")} variant="outline" className="flex-1">
                <FileSpreadsheet className="h-4 w-4 mr-1" /> XLS
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <SummaryTile label="Working Days" value={totals.workingDays} />
        <SummaryTile label="Present" value={totals.present} />
        <SummaryTile label="Late" value={totals.late} />
        <SummaryTile label="Half Day" value={totals.halfDay} />
        <SummaryTile label="On Leave" value={totals.onLeave} />
        <SummaryTile label="Total Hours" value={Math.round(totals.minutes / 60)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Working Days</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Half Day</TableHead>
                  <TableHead>On Leave</TableHead>
                  <TableHead>Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No data in the selected range.
                    </TableCell>
                  </TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                    </TableCell>
                    <TableCell>{r.department}</TableCell>
                    <TableCell className="tabular-nums">{r.workingDays}</TableCell>
                    <TableCell className="tabular-nums">{r.present}</TableCell>
                    <TableCell className="tabular-nums">{r.late}</TableCell>
                    <TableCell className="tabular-nums">{r.halfDay}</TableCell>
                    <TableCell className="tabular-nums">{r.onLeave}</TableCell>
                    <TableCell className="tabular-nums">{formatDuration(r.totalWorkingMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

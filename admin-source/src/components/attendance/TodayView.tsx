"use client";

/**
 * Today's Attendance — dedicated view for a single day, with the
 * ability to manually add a record (admin override) and to open the
 * detail dialog for corrections.
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatDuration, formatTime, photoUrl, statusColor } from "@/lib/attendance/format";
import type { AttendanceEmployee, AttendanceRecord } from "@/lib/attendance/types";
import { RecordDetailDialog } from "./RecordDetailDialog";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function TodayView() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<AttendanceRecord | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/attendance/today");
    const data = await res.json();
    setRecords(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, reloadKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Record
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
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
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No attendance recorded today yet.
                    </TableCell>
                  </TableRow>
                ) : records.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setActive(r)}
                  >
                    <TableCell>
                      <div className="font-medium">{r.employee?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.employee?.employeeCode} · {r.employee?.department}
                      </div>
                    </TableCell>
                    <TableCell>
                      {photoUrl(r.checkInPhoto) ? (
                        <img src={photoUrl(r.checkInPhoto)!} alt="check-in" className="h-8 w-8 rounded object-cover border" />
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
        record={active}
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
        onUpdated={() => setReloadKey((k) => k + 1)}
      />

      <AddRecordDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onSaved={() => {
          setShowAdd(false);
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function AddRecordDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [empId, setEmpId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [status, setStatus] = useState("PRESENT");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      void fetch("/api/attendance/employees?status=ACTIVE")
        .then((r) => r.json())
        .then((d) => setEmployees(d.items ?? []));
    }
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/attendance/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: empId,
          attendanceDate: date,
          checkInTime: checkIn ? new Date(`${date}T${checkIn}`).toISOString() : null,
          checkOutTime: checkOut ? new Date(`${date}T${checkOut}`).toISOString() : null,
          status,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      toast.success("Record created (audit logged)");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Attendance Record</DialogTitle>
          <DialogDescription>
            Manual admin entry — useful for back-filling missed attendance.
            All additions are audit-logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="emp">Employee</Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger id="emp"><SelectValue placeholder="Select employee..." /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.employeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d">Date</Label>
            <Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ci">Check In</Label>
              <Input id="ci" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co">Check Out</Label>
              <Input id="co" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="st"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="LATE">Late</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="ON_LEAVE">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !empId}>{saving ? "Saving..." : "Add Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * Admin Salary Management View.
 *
 * Two tabs:
 *   1. Configuration — set base salary, allowances, deductions, allowed holidays per employee
 *   2. Monthly Records — compute salary for a month, view breakdown, approve, mark paid
 *
 * Salary auto-calculation formula:
 *   per_day_rate = override ?? (base_salary / 30)
 *   gross = base + hra + travel + special
 *   excess_absent = max(0, absent_days - allowed_holidays_per_month)
 *   attendance_deduction = excess_absent * per_day_rate
 *   net = gross - (pf + other) - attendance_deduction
 */

import { useCallback, useEffect, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DollarSign, Calculator, CheckCircle2, Wallet, Settings2, Download,
} from "lucide-react";

type Employee = {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  role: string;
  status: string;
};

type SalarySettings = {
  id?: string;
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
  employee?: Employee;
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
  working_days_in_month: number;
  base_salary: number;
  total_allowances: number;
  total_deductions: number;
  attendance_deduction: number;
  gross_salary: number;
  net_salary: number;
  status: "DRAFT" | "APPROVED" | "PAID";
  employee?: Employee;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function SalaryView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Salary Management</h1>
        <p className="text-sm text-muted-foreground">
          Configure per-employee salary, set allowed holidays, auto-calculate monthly payroll from attendance.
        </p>
      </div>
      <Tabs defaultValue="config">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="config">
            <Settings2 className="h-4 w-4 mr-1" /> Configuration
          </TabsTrigger>
          <TabsTrigger value="records">
            <Calculator className="h-4 w-4 mr-1" /> Monthly Records
          </TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4">
          <SalaryConfigTab />
        </TabsContent>
        <TabsContent value="records" className="mt-4">
          <SalaryRecordsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =========================================================================
// TAB 1: Configuration
// =========================================================================

function SalaryConfigTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<SalarySettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ employee: Employee; settings: SalarySettings | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, setRes] = await Promise.all([
      fetch("/api/attendance/employees").then((r) => r.json()),
      fetch("/api/attendance/salary/settings").then((r) => r.json()),
    ]);
    setEmployees(empRes.items ?? []);
    setSettings(setRes.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function getSettingsFor(empId: string): SalarySettings | null {
    return settings.find((s) => s.employee_id === empId) ?? null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Per-Employee Salary Configuration</CardTitle>
        <CardDescription>
          Click any employee to set base salary, allowances, deductions, and allowed holidays per month.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Holidays/Month</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No employees found. Add employees first.
                  </TableCell>
                </TableRow>
              ) : employees.map((emp) => {
                const s = getSettingsFor(emp.id);
                const allowances = s ? s.hra_allowance + s.travel_allowance + s.special_allowance : 0;
                const deductions = s ? s.pf_deduction + s.other_deduction : 0;
                return (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.employeeCode}</div>
                    </TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell className="tabular-nums">
                      {s ? `₹${s.base_salary.toLocaleString("en-IN")}` : <span className="text-muted-foreground">Not set</span>}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s ? `₹${allowances.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s ? `₹${deductions.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s ? s.allowed_holidays_per_month : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditing({ employee: emp, settings: s })}>
                        <Settings2 className="h-3.5 w-3.5 mr-1" />
                        {s ? "Edit" : "Configure"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <SalaryConfigDialog
        open={!!editing}
        employee={editing?.employee ?? null}
        settings={editing?.settings ?? null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => { setEditing(null); void load(); }}
      />
    </Card>
  );
}

function SalaryConfigDialog({
  open, employee, settings, onOpenChange, onSaved,
}: {
  open: boolean;
  employee: Employee | null;
  settings: SalarySettings | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    baseSalary: "",
    hraAllowance: "",
    travelAllowance: "",
    specialAllowance: "",
    pfDeduction: "",
    otherDeduction: "",
    allowedHolidaysPerMonth: "2",
    perDayRateOverride: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        baseSalary: String(settings.base_salary),
        hraAllowance: String(settings.hra_allowance),
        travelAllowance: String(settings.travel_allowance),
        specialAllowance: String(settings.special_allowance),
        pfDeduction: String(settings.pf_deduction),
        otherDeduction: String(settings.other_deduction),
        allowedHolidaysPerMonth: String(settings.allowed_holidays_per_month),
        perDayRateOverride: settings.per_day_rate_override ? String(settings.per_day_rate_override) : "",
        notes: settings.notes ?? "",
      });
    } else {
      setForm({
        baseSalary: "", hraAllowance: "0", travelAllowance: "0",
        specialAllowance: "0", pfDeduction: "0", otherDeduction: "0",
        allowedHolidaysPerMonth: "2", perDayRateOverride: "", notes: "",
      });
    }
  }, [settings, open]);

  async function save() {
    if (!employee) return;
    setSaving(true);
    try {
      const res = await fetch("/api/attendance/salary/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          baseSalary: parseFloat(form.baseSalary) || 0,
          hraAllowance: parseFloat(form.hraAllowance) || 0,
          travelAllowance: parseFloat(form.travelAllowance) || 0,
          specialAllowance: parseFloat(form.specialAllowance) || 0,
          pfDeduction: parseFloat(form.pfDeduction) || 0,
          otherDeduction: parseFloat(form.otherDeduction) || 0,
          allowedHolidaysPerMonth: parseInt(form.allowedHolidaysPerMonth, 10) || 2,
          perDayRateOverride: form.perDayRateOverride ? parseFloat(form.perDayRateOverride) : null,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? err.error ?? "Failed");
      }
      toast.success(`Salary configured for ${employee.name} (audit logged)`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (!employee) return null;

  const gross = (parseFloat(form.baseSalary) || 0) + (parseFloat(form.hraAllowance) || 0) +
    (parseFloat(form.travelAllowance) || 0) + (parseFloat(form.specialAllowance) || 0);
  const totalDeductions = (parseFloat(form.pfDeduction) || 0) + (parseFloat(form.otherDeduction) || 0);
  const perDayRate = form.perDayRateOverride
    ? parseFloat(form.perDayRateOverride)
    : (parseFloat(form.baseSalary) || 0) / 30;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Salary Configuration — {employee.name}</DialogTitle>
          <DialogDescription>
            {employee.employeeCode} · {employee.department} · {employee.role}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="font-medium mb-1">Salary Formula</div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Gross = Base + HRA + Travel + Special Allowances</div>
              <div>Per-day rate = {form.perDayRateOverride ? "Override" : "Base ÷ 30"} = ₹{perDayRate.toFixed(2)}</div>
              <div>Excess absent = max(0, absent − allowed holidays)</div>
              <div>Attendance deduction = excess absent × per-day rate</div>
              <div>Net = Gross − PF − Other − Attendance deduction</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Base Salary (₹/month) *</Label>
              <Input type="number" placeholder="25000" value={form.baseSalary}
                onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Allowed Holidays / Month</Label>
              <Input type="number" placeholder="2" value={form.allowedHolidaysPerMonth}
                onChange={(e) => setForm({ ...form, allowedHolidaysPerMonth: e.target.value })} />
              <p className="text-xs text-muted-foreground">Absences beyond this → salary deduction</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>HRA Allowance</Label>
              <Input type="number" placeholder="0" value={form.hraAllowance}
                onChange={(e) => setForm({ ...form, hraAllowance: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Travel Allowance</Label>
              <Input type="number" placeholder="0" value={form.travelAllowance}
                onChange={(e) => setForm({ ...form, travelAllowance: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Special Allowance</Label>
              <Input type="number" placeholder="0" value={form.specialAllowance}
                onChange={(e) => setForm({ ...form, specialAllowance: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>PF Deduction</Label>
              <Input type="number" placeholder="0" value={form.pfDeduction}
                onChange={(e) => setForm({ ...form, pfDeduction: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Other Deduction</Label>
              <Input type="number" placeholder="0" value={form.otherDeduction}
                onChange={(e) => setForm({ ...form, otherDeduction: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Per-day Rate Override (optional)</Label>
            <Input type="number" placeholder="Auto: base ÷ 30" value={form.perDayRateOverride}
              onChange={(e) => setForm({ ...form, perDayRateOverride: e.target.value })} />
            <p className="text-xs text-muted-foreground">Leave blank to auto-calculate as base ÷ 30</p>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Optional notes about this salary configuration..." rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="rounded-lg border p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Salary</span>
              <span className="font-medium tabular-nums">₹{gross.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Deductions (fixed)</span>
              <span className="font-medium tabular-nums text-rose-600">−₹{totalDeductions.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Per-day Rate</span>
              <span className="font-medium tabular-nums">₹{perDayRate.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="font-medium">Net (before attendance deduction)</span>
              <span className="font-bold tabular-nums">₹{(gross - totalDeductions).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.baseSalary}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// TAB 2: Monthly Records
// =========================================================================

function SalaryRecordsTab() {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [detail, setDetail] = useState<SalaryRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/attendance/salary/records?month=${month}&year=${year}`);
    const data = await res.json();
    setRecords(data.items ?? []);
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function computeAll() {
    setComputing(true);
    try {
      const res = await fetch("/api/attendance/salary/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? err.error ?? "Failed");
      }
      const data = await res.json();
      toast.success(`Computed salary for ${data.computed} employees`);
      if (data.errors?.length > 0) {
        toast.warning(`${data.errors.length} employees skipped (no salary config)`);
      }
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setComputing(false);
    }
  }

  async function updateStatus(record: SalaryRecord, status: "DRAFT" | "APPROVED" | "PAID") {
    try {
      const res = await fetch(`/api/attendance/salary/records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Salary ${status.toLowerCase()} (audit logged)`);
      void load();
    } catch {
      toast.error("Failed to update status");
    }
  }

  const totalNet = records.reduce((sum, r) => sum + Number(r.net_salary), 0);
  const totalGross = records.reduce((sum, r) => sum + Number(r.gross_salary), 0);
  const totalDeduction = records.reduce(
    (sum, r) => sum + Number(r.total_deductions) + Number(r.attendance_deduction), 0
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="w-24" />
            </div>
            <Button onClick={computeAll} disabled={computing} className="ml-auto">
              <Calculator className="h-4 w-4 mr-1" />
              {computing ? "Computing..." : "Calculate All"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Gross</div>
          <div className="text-2xl font-semibold tabular-nums">₹{totalGross.toLocaleString("en-IN")}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Deductions</div>
          <div className="text-2xl font-semibold tabular-nums text-rose-600">−₹{totalDeduction.toLocaleString("en-IN")}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Net Payable</div>
          <div className="text-2xl font-semibold tabular-nums text-emerald-600">₹{totalNet.toLocaleString("en-IN")}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Half</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Deduct</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No salary records for {MONTHS[month - 1]} {year}.
                      <br />
                      Click "Calculate All" to auto-compute from attendance.
                    </TableCell>
                  </TableRow>
                ) : records.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetail(r)}>
                    <TableCell>
                      <div className="font-medium">{r.employee?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.employee?.employee_code}</div>
                    </TableCell>
                    <TableCell className="tabular-nums">{r.present_days}</TableCell>
                    <TableCell className="tabular-nums text-amber-600">{r.late_days}</TableCell>
                    <TableCell className="tabular-nums text-rose-600">{r.absent_days}</TableCell>
                    <TableCell className="tabular-nums">{r.half_days}</TableCell>
                    <TableCell className="tabular-nums">₹{Number(r.gross_salary).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="tabular-nums text-rose-600">
                      −₹{(Number(r.total_deductions) + Number(r.attendance_deduction)).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">₹{Number(r.net_salary).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        r.status === "PAID" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                        r.status === "APPROVED" ? "bg-sky-100 text-sky-700 border-sky-200" :
                        "bg-amber-100 text-amber-700 border-amber-200"
                      }>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {r.status === "DRAFT" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(r, "APPROVED")} title="Approve">
                            <CheckCircle2 className="h-3.5 w-3.5 text-sky-600" />
                          </Button>
                        )}
                        {r.status === "APPROVED" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(r, "PAID")} title="Mark Paid">
                            <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SalaryDetailDialog record={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}

function SalaryDetailDialog({
  record, open, onOpenChange,
}: {
  record: SalaryRecord | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!record) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salary Slip — {record.employee?.name}</DialogTitle>
          <DialogDescription>
            {MONTHS[record.month - 1]} {record.year} · {record.employee?.employee_code}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Present Days</div>
              <div className="font-medium tabular-nums">{record.present_days}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Late Days</div>
              <div className="font-medium tabular-nums">{record.late_days}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Half Days</div>
              <div className="font-medium tabular-nums">{record.half_days}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Absent Days</div>
              <div className="font-medium tabular-nums text-rose-600">{record.absent_days}</div>
            </div>
          </div>
          <div className="space-y-1 border-t pt-2">
            <Row label="Base Salary" value={`₹${Number(record.base_salary).toLocaleString("en-IN")}`} />
            <Row label="Total Allowances" value={`+₹${Number(record.total_allowances).toLocaleString("en-IN")}`} />
            <Row label="Gross Salary" value={`₹${Number(record.gross_salary).toLocaleString("en-IN")}`} bold />
            <Row label="Fixed Deductions" value={`−₹${Number(record.total_deductions).toLocaleString("en-IN")}`} red />
            <Row label="Attendance Deduction" value={`−₹${Number(record.attendance_deduction).toLocaleString("en-IN")}`} red />
            <div className="flex justify-between border-t pt-1 text-base font-bold">
              <span>Net Salary</span>
              <span className="tabular-nums text-emerald-600">₹${Number(record.net_salary).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold, red }: { label: string; value: string; bold?: boolean; red?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-medium" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${red ? "text-rose-600" : ""}`}>{value}</span>
    </div>
  );
}

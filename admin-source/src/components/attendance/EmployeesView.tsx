"use client";

/**
 * Employees management view — add / edit / activate / deactivate /
 * reset password / view monthly statistics.
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Search, UserPlus, KeyRound, Ban, CheckCircle2, Eye } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceEmployee } from "@/lib/attendance/types";

const DEPARTMENTS = ["Construction", "HR", "Finance", "Operations", "Design", "Marketing", "IT"];

export function EmployeesView() {
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AttendanceEmployee | null>(null);
  const [resetting, setResetting] = useState<AttendanceEmployee | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    const res = await fetch(`/api/attendance/employees?${params}`);
    const data = await res.json();
    setEmployees(data.items ?? []);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function toggleStatus(emp: AttendanceEmployee) {
    const next = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/attendance/employees/${emp.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      toast.success(`${emp.name} ${next === "ACTIVE" ? "reactivated" : "deactivated"} (audit logged)`);
      void load();
    } else {
      toast.error("Failed to update status");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Manage staff attendance accounts. All data lives in the isolated attendance Supabase.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Add Employee
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "ALL" | "ACTIVE" | "INACTIVE")}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No employees match the filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {emp.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{emp.name}</div>
                            <div className="text-xs text-muted-foreground">{emp.employeeCode}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell className="text-sm">{emp.role}</TableCell>
                      <TableCell className="font-mono text-sm">{emp.phone}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={emp.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                            : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800"}
                        >
                          {emp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(emp)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setResetting(emp)}>
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleStatus(emp)}
                            title={emp.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                          >
                            {emp.status === "ACTIVE" ? (
                              <Ban className="h-3.5 w-3.5 text-rose-500" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EmployeeFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSaved={() => {
          setShowCreate(false);
          void load();
        }}
      />

      <EmployeeFormDialog
        open={!!editing}
        employee={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />

      <ResetPasswordDialog
        employee={resetting}
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        onDone={() => setResetting(null)}
      />
    </div>
  );
}

function EmployeeFormDialog({
  open,
  employee,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  employee?: AttendanceEmployee | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    employeeCode: "",
    name: "",
    phone: "",
    department: DEPARTMENTS[0],
    role: "Staff",
    password: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        employeeCode: employee.employeeCode,
        name: employee.name,
        phone: employee.phone,
        department: employee.department,
        role: employee.role,
        password: "",
      });
    } else {
      setForm({
        employeeCode: "",
        name: "",
        phone: "",
        department: DEPARTMENTS[0],
        role: "Staff",
        password: "",
      });
    }
  }, [employee, open]);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...form };
      if (!form.password) delete body.password;
      const url = isEdit
        ? `/api/attendance/employees/${employee!.id}`
        : "/api/attendance/employees";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      toast.success(isEdit ? "Employee updated (audit logged)" : "Employee created (audit logged)");
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
          <DialogTitle>{isEdit ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update employee details. Changes are audit-logged."
              : "Create a new staff attendance account."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Employee Code</Label>
              <Input id="code" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept">Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger id="dept">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">
              {isEdit ? "New Password (leave blank to keep current)" : "Initial Password"}
            </Label>
            <Input
              id="pw"
              type="text"
              placeholder={isEdit ? "••••••••" : "Set initial login password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Staff will use this password to log in to the staff attendance portal.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  employee,
  open,
  onOpenChange,
  onDone,
}: {
  employee: AttendanceEmployee | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setPw("");
  }, [open]);

  async function reset() {
    if (!employee) return;
    if (pw.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/employees/${employee.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Password reset (audit logged)");
      onDone();
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new staff login password for <strong>{employee?.name}</strong> ({employee?.employeeCode}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="npw">New Password</Label>
          <Input id="npw" type="text" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={reset} disabled={saving}>{saving ? "Resetting..." : "Reset Password"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * Audit Log view — read-only feed of all admin mutations in the
 * attendance module.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatDateTime } from "@/lib/attendance/format";
import type { AttendanceAuditLog } from "@/lib/attendance/types";

const ACTION_COLOR: Record<string, string> = {
  EMPLOYEE_CREATED: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  EMPLOYEE_UPDATED: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  EMPLOYEE_DEACTIVATED: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  EMPLOYEE_REACTIVATED: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  EMPLOYEE_PASSWORD_RESET: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  RECORD_UPDATED: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  RECORD_CANCELLED: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  RECORD_DELETED: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  LOCATION_CREATED: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  LOCATION_UPDATED: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  LOCATION_DELETED: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  SETTINGS_UPDATED: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
};

export function AuditView() {
  const [items, setItems] = useState<AttendanceAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/attendance/audit?pageSize=100");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Every administrative mutation in the attendance module, recorded with admin identifier + previous / new values.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mutation History</CardTitle>
          <CardDescription>Most recent 100 entries — stored only in the attendance Supabase project</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-hidden max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Old → New</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No audit entries yet.
                    </TableCell>
                  </TableRow>
                ) : items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell className="text-xs">{log.adminUserIdentifier}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ACTION_COLOR[log.action] ?? "bg-zinc-100 text-zinc-700 border-zinc-200"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono">{log.entityType}</div>
                      {log.entityId && <div className="text-muted-foreground truncate max-w-[160px]">{log.entityId}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2 max-w-md">
                        {log.oldValue && (
                          <code className="px-1 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 truncate">
                            {truncate(log.oldValue, 60)}
                          </code>
                        )}
                        <span className="text-muted-foreground">→</span>
                        {log.newValue && (
                          <code className="px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 truncate">
                            {truncate(log.newValue, 60)}
                          </code>
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
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

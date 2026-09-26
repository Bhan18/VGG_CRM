"use client";

/**
 * Attendance record detail dialog — shows check-in/out photos, GPS,
 * distance from permitted location, status, and admin edit form.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Save, Clock, Calendar } from "lucide-react";
import { formatDateTime, formatDuration, formatTime, photoUrl, statusColor } from "@/lib/attendance/format";
import type { AttendanceRecord } from "@/lib/attendance/types";

type Props = {
  record: AttendanceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

export function RecordDetailDialog({ record, open, onOpenChange, onUpdated }: Props) {
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editStatus, setEditStatus] = useState<string>("PRESENT");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    setEditCheckIn(toLocalInput(record.checkInTime));
    setEditCheckOut(toLocalInput(record.checkOutTime));
    setEditStatus(record.status);
  }, [record]);

  if (!record) return null;

  async function save() {
    if (!record) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/records/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInTime: editCheckIn ? new Date(editCheckIn).toISOString() : null,
          checkOutTime: editCheckOut ? new Date(editCheckOut).toISOString() : null,
          status: editStatus,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update record");
      }
      toast.success("Attendance record updated (audit log entry created)");
      onUpdated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function cancelRecord() {
    if (!record) return;
    if (!confirm("Cancel this attendance record? This is a soft-cancel (status = CANCELLED) and is fully audit-logged.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/records/${record.id}?mode=cancel`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to cancel");
      toast.success("Record cancelled (audit log entry created)");
      onUpdated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{record.employee?.name}</span>
            <Badge variant="outline" className={statusColor(record.status)}>
              {record.status.replace("_", " ")}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {record.employee?.employeeCode} · {record.employee?.department} ·{" "}
            {formatDateTime(record.attendanceDate)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="detail">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="detail">Details</TabsTrigger>
            <TabsTrigger value="edit">Admin Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="detail" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoTile label="Check-In" value={formatTime(record.checkInTime)} icon={Clock} />
              <InfoTile label="Check-Out" value={formatTime(record.checkOutTime)} icon={Clock} />
              <InfoTile label="Working Duration" value={formatDuration(record.workingMinutes)} icon={Calendar} />
              <InfoTile label="Marked By" value={record.markedBy} icon={Clock} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <PhotoTile
                title="Check-In Photo"
                url={photoUrl(record.checkInPhoto)}
                gps={
                  record.checkInLatitude != null && record.checkInLongitude != null
                    ? `${record.checkInLatitude.toFixed(5)}, ${record.checkInLongitude.toFixed(5)}`
                    : null
                }
                distance={record.checkInDistance}
              />
              <PhotoTile
                title="Check-Out Photo"
                url={photoUrl(record.checkOutPhoto)}
                gps={
                  record.checkOutLatitude != null && record.checkOutLongitude != null
                    ? `${record.checkOutLatitude.toFixed(5)}, ${record.checkOutLongitude.toFixed(5)}`
                    : null
                }
                distance={record.checkOutDistance}
              />
            </div>

            <div className="text-xs text-muted-foreground rounded-md bg-muted/40 p-3">
              All attendance photos are served from the dedicated attendance
              Supabase Storage bucket (<code>attendance-photos</code>) — never
              from your existing Supabase project.
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ci">Check-In Time</Label>
                <Input
                  id="ci"
                  type="datetime-local"
                  value={editCheckIn}
                  onChange={(e) => setEditCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co">Check-Out Time</Label>
                <Input
                  id="co"
                  type="datetime-local"
                  value={editCheckOut}
                  onChange={(e) => setEditCheckOut(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="st">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id="st">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                    <SelectItem value="HALF_DAY">Half Day</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={save} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={cancelRecord} disabled={saving}>
                Cancel Record
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Every change is recorded in the attendance audit log with the
              previous value, new value, and admin identifier.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 font-medium tabular-nums">{value}</div>
    </div>
  );
}

function PhotoTile({ title, url, gps, distance }: { title: string; url: string | null; gps: string | null; distance: number | null }) {
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="text-xs font-medium mb-2">{title}</div>
      {url ? (
        <img src={url} alt={title} className="w-full h-40 object-cover rounded-md border" />
      ) : (
        <div className="w-full h-40 rounded-md border flex items-center justify-center text-muted-foreground text-xs">
          No photo
        </div>
      )}
      <div className="mt-2 text-xs space-y-1">
        {gps && (
          <div className="flex items-start gap-1 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5" />
            <span className="font-mono">{gps}</span>
          </div>
        )}
        {distance != null && (
          <div className="text-muted-foreground">
            Distance from permitted location: <span className="font-mono">{distance} m</span>
          </div>
        )}
      </div>
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

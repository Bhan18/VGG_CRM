"use client";

/**
 * Permitted Locations view — geofences for attendance verification.
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceLocation } from "@/lib/attendance/types";

export function LocationsView() {
  const [items, setItems] = useState<AttendanceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AttendanceLocation | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/attendance/locations");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function remove(loc: AttendanceLocation) {
    if (!confirm(`Delete location "${loc.name}"? This is audit-logged.`)) return;
    const res = await fetch(`/api/attendance/locations/${loc.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Location deleted (audit logged)");
      void load();
    } else {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance Locations</h1>
          <p className="text-sm text-muted-foreground">
            Geofenced locations where staff are permitted to mark attendance.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Location
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>Allowed Radius</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No locations yet. Add your office GPS coordinates to start.
                    </TableCell>
                  </TableRow>
                ) : items.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{loc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{loc.latitude.toFixed(5)}</TableCell>
                    <TableCell className="font-mono text-xs">{loc.longitude.toFixed(5)}</TableCell>
                    <TableCell className="tabular-nums">{loc.allowedRadius} m</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={loc.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                        : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800"}
                      >
                        {loc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(loc)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(loc)}>
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <LocationFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSaved={() => {
          setShowCreate(false);
          void load();
        }}
      />
      <LocationFormDialog
        open={!!editing}
        location={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    </div>
  );
}

function LocationFormDialog({
  open,
  location,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  location?: AttendanceLocation | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = !!location;
  const [form, setForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    allowedRadius: "200",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (location) {
      setForm({
        name: location.name,
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        allowedRadius: String(location.allowedRadius),
        status: location.status,
      });
    } else {
      setForm({ name: "", latitude: "", longitude: "", allowedRadius: "200", status: "ACTIVE" });
    }
  }, [location, open]);

  async function save() {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        allowedRadius: parseInt(form.allowedRadius, 10),
        status: form.status,
      };
      if (!body.name || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) {
        throw new Error("Name + valid latitude / longitude required");
      }
      const url = isEdit ? `/api/attendance/locations/${location!.id}` : "/api/attendance/locations";
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
      toast.success(isEdit ? "Location updated (audit logged)" : "Location created (audit logged)");
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
          <DialogTitle>{isEdit ? "Edit Location" : "Add Permitted Location"}</DialogTitle>
          <DialogDescription>
            Define a geofence where staff are allowed to mark attendance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Location Name</Label>
            <Input id="name" placeholder="e.g. VGG Infra Office" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lat">Latitude</Label>
              <Input id="lat" placeholder="17.3850" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lon">Longitude</Label>
              <Input id="lon" placeholder="78.4867" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rad">Allowed Radius (metres)</Label>
            <Input id="rad" type="number" value={form.allowedRadius} onChange={(e) => setForm({ ...form, allowedRadius: e.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: stand at the centre of the permitted area, open Google Maps,
            long-press to drop a pin, and copy the lat / long shown.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Location"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

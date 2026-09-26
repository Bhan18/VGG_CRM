"use client";

/**
 * Attendance Settings view — configure office start time, late / half-day
 * thresholds, minimum working hours, photo + GPS requirements, timezone.
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save } from "lucide-react";
import type { AttendanceSettings } from "@/lib/attendance/types";

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export function SettingsView() {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/attendance/settings");
    const data = await res.json();
    setSettings(data.settings);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/attendance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Settings saved (audit logged)");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global attendance rules. Changes are audit-logged and applied to all future attendance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Working Hours</CardTitle>
          <CardDescription>Configure office start time + late / half-day thresholds</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="ost">Office Start Time</Label>
            <Input
              id="ost"
              type="time"
              value={settings.officeStartTime}
              onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lam">Late After (minutes)</Label>
            <Input
              id="lam"
              type="number"
              value={settings.lateAfterMinutes}
              onChange={(e) => setSettings({ ...settings, lateAfterMinutes: parseInt(e.target.value, 10) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hdam">Half-Day After (minutes)</Label>
            <Input
              id="hdam"
              type="number"
              value={settings.halfDayAfterMinutes}
              onChange={(e) => setSettings({ ...settings, halfDayAfterMinutes: parseInt(e.target.value, 10) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mwm">Min Working (minutes)</Label>
            <Input
              id="mwm"
              type="number"
              value={settings.minimumWorkingMinutes}
              onChange={(e) => setSettings({ ...settings, minimumWorkingMinutes: parseInt(e.target.value, 10) })}
            />
            <p className="text-xs text-muted-foreground">{(settings.minimumWorkingMinutes / 60).toFixed(1)} hours</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification Requirements</CardTitle>
          <CardDescription>Toggle photo / GPS verification for staff attendance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium text-sm">Require Photo Capture</div>
              <div className="text-xs text-muted-foreground">Staff must capture a live camera photo (no gallery uploads).</div>
            </div>
            <Switch
              checked={settings.requirePhoto}
              onCheckedChange={(v) => setSettings({ ...settings, requirePhoto: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium text-sm">Require GPS Verification</div>
              <div className="text-xs text-muted-foreground">Staff must be inside a permitted location radius.</div>
            </div>
            <Switch
              checked={settings.requireLocation}
              onCheckedChange={(v) => setSettings({ ...settings, requireLocation: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tz">Timezone</Label>
            <Select value={settings.timezone} onValueChange={(v) => setSettings({ ...settings, timezone: v })}>
              <SelectTrigger id="tz"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}


"use client";

import { useCrm } from "@/lib/store";
import { seedSettings } from "@/lib/seed-data";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Save, Building2, Wallet, Database, RotateCcw, Upload, Check, Activity, HardDriveDownload, HardDriveUpload, Trash2, Clock, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { relativeTime, inr, formatDate } from "@/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const { settings, updateSettings, activityLogs, resetToSeed } = useCrm();
  const { toast } = useToast();
  const [form, setForm] = useState(settings);
  const [showReset, setShowReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    updateSettings(form);
    toast({ title: "Settings saved", description: "Company information updated" });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast({ title: "Logo too large", description: "Max 512KB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, companyLogo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const recentLogs = useMemo(() => activityLogs.slice(0, 25), [activityLogs]);

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Settings"
        description="Company information, bank details, payment gateway, and system maintenance."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowReset(true)}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restore Demo Data
            </Button>
            <Button onClick={handleSave} className="bg-primary">
              <Save className="w-3.5 h-3.5 mr-1.5" /> Save Changes
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Company info */}
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-primary" />
            <div className="font-semibold text-sm">Company Information</div>
          </div>

          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 rounded-xl">
              {form.companyLogo ? (
                <img src={form.companyLogo} alt="logo" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <AvatarFallback className="bg-primary/15 text-primary rounded-xl">
                  <Building2 className="w-7 h-7" />
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Logo
              </Button>
              {form.companyLogo && (
                <Button type="button" variant="ghost" size="sm" className="ml-2 text-rose-600" onClick={() => setForm((f) => ({ ...f, companyLogo: "" }))}>
                  Remove
                </Button>
              )}
              <div className="text-[11px] text-muted-foreground mt-1">Square image, max 512KB</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Company Name</Label>
              <Input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">GST Number</Label>
              <Input value={form.gst ?? ""} onChange={(e) => setForm((f) => ({ ...f, gst: e.target.value }))} placeholder="29AABCV1234M1Z5" />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Address</Label>
              <Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
        </Card>

        {/* Payment configuration */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-primary" />
            <div className="font-semibold text-sm">Payments & Banking</div>
          </div>

          <div>
            <Label className="text-xs">UPI ID</Label>
            <Input value={form.upi ?? ""} onChange={(e) => setForm((f) => ({ ...f, upi: e.target.value }))} placeholder="company@bank" />
          </div>
          <div>
            <Label className="text-xs">Payment Gateway</Label>
            <Input value={form.paymentGateway ?? ""} onChange={(e) => setForm((f) => ({ ...f, paymentGateway: e.target.value }))} placeholder="Razorpay / PayU / Stripe" />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Bank Details</Label>
            <Input
              placeholder="Bank Name"
              value={form.bankDetails?.bankName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, bankDetails: { ...f.bankDetails, bankName: e.target.value } }))}
            />
            <Input
              placeholder="Account Name"
              value={form.bankDetails?.accountName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, bankDetails: { ...f.bankDetails, accountName: e.target.value } }))}
            />
            <Input
              placeholder="Account Number"
              value={form.bankDetails?.accountNumber ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, bankDetails: { ...f.bankDetails, accountNumber: e.target.value } }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="IFSC"
                value={form.bankDetails?.ifsc ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, bankDetails: { ...f.bankDetails, ifsc: e.target.value } }))}
              />
              <Input
                placeholder="Branch"
                value={form.bankDetails?.branch ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, bankDetails: { ...f.bankDetails, branch: e.target.value } }))}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Database / Future integration */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-primary" />
          <div className="font-semibold text-sm">Data Layer & Future Integration</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <div className="font-medium mb-1">Current storage</div>
            <div className="text-xs text-muted-foreground">
              Data is persisted in browser localStorage via Zustand <code>persist</code> middleware. This is suitable for demo / single-machine use.
            </div>
            <Badge variant="outline" className="text-[10px] mt-2 bg-emerald-50 text-emerald-700 border-transparent">
              <Check className="w-3 h-3 mr-1" /> Active
            </Badge>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <div className="font-medium mb-1">Future backend swap</div>
            <div className="text-xs text-muted-foreground">
              The data layer is fully isolated in <code>src/lib/store.ts</code>. To connect Firebase, MySQL, Supabase, or PostgreSQL, only that file needs updating — UI components remain untouched.
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {["Firebase", "Supabase", "MySQL", "PostgreSQL", "Prisma"].map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Backup & Restore */}
      <BackupSection />

      {/* Activity log */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <div className="font-semibold text-sm">Activity Log</div>
          <Badge variant="outline" className="text-[10px] ml-2">{activityLogs.length} events</Badge>
        </div>
        <div className="max-h-72 overflow-y-auto space-y-1 -mr-2 pr-2">
          {recentLogs.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">No activity yet</div>
          ) : (
            recentLogs.map((a) => (
              <div key={a.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/40 text-xs">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-semibold shrink-0">
                  {a.userName?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div>
                    <span className="font-medium">{a.userName}</span>{" "}
                    <span className="text-muted-foreground">{a.details}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {relativeTime(a.timestamp)} · {a.action.replace(/_/g, " ").toLowerCase()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace ALL current data (projects, layouts, plots, customers, bookings, sales, payments) with the original VGG Infra demo seed. Useful for demos. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetToSeed();
                setForm(seedSettings);
                toast({ title: "Demo data restored" });
                setShowReset(false);
              }}
              className="bg-primary"
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// BACKUP SECTION — one-click backup, restore, auto-backup config
// ============================================================
interface BackupMeta {
  id: string;
  created_at: string;
  size_bytes: number;
  table_counts: Record<string, number>;
  trigger: string;
  status: string;
  error: string | null;
}

interface BackupConfig {
  auto_backup_enabled: boolean;
  retention_days: number;
  last_backup_at: string | null;
  last_backup_id: string | null;
  last_backup_status: string | null;
  last_backup_trigger: string | null;
}

function BackupSection() {
  const { toast } = useToast();
  const { loadFromSupabase } = useCrm();
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<BackupMeta | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backup/list");
      if (!res.ok) throw new Error("Failed to load backup data");
      const data = await res.json();
      setBackups(data.backups || []);
      setConfig(data.config || null);
    } catch (e) {
      // Silent fail — backup table might not exist yet (schema not applied)
      console.warn("Backup section load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleBackupNow = async () => {
    try {
      setBacking(true);
      const res = await fetch("/api/backup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Backup failed");
      }
      const result = await res.json();
      toast({
        title: "Backup created",
        description: `${Object.values(result.tableCounts).reduce((a: number, b) => a + (b as number), 0)} records · ${(result.sizeBytes / 1024).toFixed(1)} KB`,
      });
      refresh();
    } catch (e) {
      toast({
        title: "Backup failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async (backup: BackupMeta) => {
    try {
      setRestoringId(backup.id);
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: backup.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Restore failed");
      }
      const result = await res.json();
      const total = Object.values(result.restored).reduce((a: number, b) => a + (b as number), 0);
      toast({
        title: "Restore complete",
        description: `${total} records restored from ${formatDate(backup.created_at)}`,
      });
      // Reload all CRM data from Supabase so the UI reflects the restored state
      await loadFromSupabase();
      setRestoreConfirm(null);
      refresh();
    } catch (e) {
      toast({
        title: "Restore failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (backup: BackupMeta) => {
    try {
      setDeletingId(backup.id);
      const res = await fetch("/api/backup/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: backup.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
      toast({ title: "Backup deleted" });
      refresh();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfigChange = async (patch: Partial<BackupConfig>) => {
    try {
      const res = await fetch("/api/backup/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update config");
      const updated = await res.json();
      setConfig(updated);
    } catch (e) {
      toast({
        title: "Config update failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const lastBackupStatus = config?.last_backup_status;
  const lastBackupTime = config?.last_backup_at;
  const isStale = !lastBackupTime || (Date.now() - new Date(lastBackupTime).getTime()) > 24 * 60 * 60 * 1000;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <HardDriveDownload className="w-4 h-4 text-primary" />
          <div className="font-semibold text-sm">Backup &amp; Restore</div>
          {lastBackupStatus === "complete" && !isStale && (
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-transparent">
              <ShieldCheck className="w-3 h-3 mr-1" /> Protected
            </Badge>
          )}
          {isStale && lastBackupTime && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-transparent">
              <AlertTriangle className="w-3 h-3 mr-1" /> Stale
            </Badge>
          )}
          {!lastBackupTime && (
            <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-transparent">
              <AlertTriangle className="w-3 h-3 mr-1" /> No backup yet
            </Badge>
          )}
        </div>
        <Button
          onClick={handleBackupNow}
          disabled={backing}
          className="bg-primary"
          size="sm"
        >
          {backing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <HardDriveDownload className="w-3.5 h-3.5 mr-1.5" />}
          {backing ? "Backing up…" : "Backup Now"}
        </Button>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Last Backup
          </div>
          <div className="text-sm font-semibold mt-1">
            {lastBackupTime ? relativeTime(lastBackupTime) : "Never"}
          </div>
          {lastBackupTime && (
            <div className="text-[10px] text-muted-foreground">{formatDate(lastBackupTime)}</div>
          )}
        </div>
        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-[10px] uppercase text-muted-foreground">Status</div>
          <div className={`text-sm font-semibold mt-1 ${lastBackupStatus === "complete" ? "text-emerald-600" : lastBackupStatus === "failed" ? "text-rose-600" : "text-muted-foreground"}`}>
            {lastBackupStatus ?? "—"}
          </div>
          {config?.last_backup_trigger && (
            <div className="text-[10px] text-muted-foreground">via {config.last_backup_trigger}</div>
          )}
        </div>
        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-[10px] uppercase text-muted-foreground">Total Backups</div>
          <div className="text-sm font-semibold mt-1">{backups.length}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-[10px] uppercase text-muted-foreground">Auto-Backup</div>
          <div className="text-sm font-semibold mt-1">
            {config?.auto_backup_enabled ? (
              <span className="text-emerald-600">Every 24h</span>
            ) : (
              <span className="text-muted-foreground">Off</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Keep last {config?.retention_days ?? 30}
          </div>
        </div>
      </div>

      {/* Auto-backup config */}
      <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/20 mb-4 flex-wrap">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={config?.auto_backup_enabled ?? true}
            onChange={(e) => handleConfigChange({ auto_backup_enabled: e.target.checked })}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="font-medium">Auto-backup every 24 hours</span>
        </label>
        <Separator orientation="vertical" className="h-6" />
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Retention:</span>
          <input
            type="number"
            min={1}
            max={90}
            value={config?.retention_days ?? 30}
            onChange={(e) => handleConfigChange({ retention_days: parseInt(e.target.value) || 30 })}
            className="w-16 h-7 px-2 rounded border border-border bg-card text-xs"
          />
          <span className="text-muted-foreground">days</span>
        </label>
        <div className="text-[10px] text-muted-foreground ml-auto">
          Auto-backup runs via Vercel Cron (daily) or when an admin logs in if backup is &gt;24h old.
        </div>
      </div>

      {/* Backup history */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto -mr-2 pr-2">
        {loading ? (
          <div className="text-center text-xs text-muted-foreground py-6 flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading backups…
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6">
            No backups yet. Click &ldquo;Backup Now&rdquo; to create your first backup.
          </div>
        ) : (
          backups.map((b) => {
            const totalRecords = Object.values(b.table_counts || {}).reduce((a, c) => a + (c as number), 0);
            return (
              <div
                key={b.id}
                className={`flex items-center gap-3 p-2.5 rounded-md border text-xs ${
                  b.status === "failed" ? "border-rose-200 bg-rose-50/30" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
                  b.status === "failed" ? "bg-rose-100 text-rose-600" : "bg-primary/10 text-primary"
                }`}>
                  {b.trigger === "cron" ? <Clock className="w-4 h-4" /> : b.trigger === "auto" ? <Activity className="w-4 h-4" /> : <HardDriveDownload className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {formatDate(b.created_at)} · {relativeTime(b.created_at)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {b.status === "failed" ? (
                      <span className="text-rose-600">Failed: {b.error || "Unknown error"}</span>
                    ) : (
                      <>
                        {totalRecords} records · {(b.size_bytes / 1024).toFixed(1)} KB · via {b.trigger}
                        {b.table_counts && (
                          <span className="ml-1">
                            ({Object.entries(b.table_counts).map(([t, c]) => `${t}:${c}`).join(", ")})
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {b.status !== "failed" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      disabled={restoringId === b.id}
                      onClick={() => setRestoreConfirm(b)}
                    >
                      {restoringId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <HardDriveUpload className="w-3 h-3" />}
                      <span className="ml-1 hidden sm:inline">Restore</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                      disabled={deletingId === b.id}
                      onClick={() => handleDelete(b)}
                    >
                      {deletingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!restoreConfirm} onOpenChange={(o) => !o && setRestoreConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>replace ALL current data</strong> (projects, layouts, plots, customers,
              bookings, sales, payments, settings) with the snapshot from{" "}
              <strong>{restoreConfirm ? formatDate(restoreConfirm.created_at) : ""}</strong>.
              <br /><br />
              The current data will be permanently overwritten. Consider creating a new backup first
              if you want to preserve the current state. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreConfirm && handleRestore(restoreConfirm)}
              disabled={!!restoringId}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {restoringId ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <HardDriveUpload className="w-3.5 h-3.5 mr-1.5" />}
              {restoringId ? "Restoring…" : "Restore Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}



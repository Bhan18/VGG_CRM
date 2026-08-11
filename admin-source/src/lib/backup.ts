
// ============================================================
// Backup & Restore Logic — Supabase Free Tier Compatible
// ============================================================
// Uses JSON snapshots stored in the `backups` table (jsonb column).
// No pg_dump / pg_cron / Edge Functions required.
//
// Backup:  fetch all tables → combine into JSON → insert into backups table
// Restore: read backup JSON → delete existing data (FK-safe order) → re-insert
// Auto:    Vercel Cron hits /api/backup/cron daily, OR client-side fallback
//          checks last_backup_at on app load and triggers if >24h stale.
// ============================================================

import { supabaseAdmin } from "./supabase-admin";

// Tables to backup, in FK-safe INSERT order (parents before children).
// user_profiles is backed up but on restore we only upsert (can't delete due to FK to auth.users).
const BACKUP_TABLES = [
  "projects",
  "layouts",
  "plots",
  "customers",
  "bookings",
  "sales",
  "payments",
  "settings",
  "activity_logs",
  "user_profiles",
  "marketing_cadres",
  "marketing_agents",
  "marketing_expenses",
  "commission_payouts",
  "marketing_settings",
  "marketing_sales",
] as const;

// Reverse order for DELETE (children before parents).
const DELETE_ORDER = [...BACKUP_TABLES].reverse();

export interface BackupResult {
  id: string;
  createdAt: string;
  sizeBytes: number;
  tableCounts: Record<string, number>;
  trigger: "manual" | "auto" | "cron";
  status: "complete" | "failed";
  error?: string;
}

export interface BackupMeta {
  id: string;
  created_at: string;
  size_bytes: number;
  table_counts: Record<string, number>;
  trigger: string;
  status: string;
  error: string | null;
}

export interface BackupConfig {
  auto_backup_enabled: boolean;
  retention_days: number;
  last_backup_at: string | null;
  last_backup_id: string | null;
  last_backup_status: string | null;
  last_backup_trigger: string | null;
}

// ---- CREATE BACKUP ----
export async function createBackup(trigger: "manual" | "auto" | "cron" = "manual"): Promise<BackupResult> {
  const snapshot: Record<string, unknown[]> = {};
  const tableCounts: Record<string, number> = {};

  // 1. Fetch all tables
  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabaseAdmin.from(table).select("*");
    if (error) throw new Error(`Backup: failed to read ${table}: ${error.message}`);
    snapshot[table] = data || [];
    tableCounts[table] = (data || []).length;
  }

  // 2. Build the JSON payload
  const payload = {
    version: 1,
    created_at: new Date().toISOString(),
    trigger,
    tables: snapshot,
  };
  const jsonStr = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(jsonStr, "utf8");

  // 3. Insert into backups table
  const { data: backupRow, error: insertError } = await supabaseAdmin
    .from("backups")
    .insert({
      created_at: payload.created_at,
      size_bytes: sizeBytes,
      table_counts: tableCounts,
      trigger,
      status: "complete",
      data: payload,
    })
    .select("id, created_at")
    .single();

  if (insertError) throw new Error(`Backup: failed to save snapshot: ${insertError.message}`);

  // 4. Update backup_config with last backup info
  await supabaseAdmin.from("backup_config").upsert({
    id: 1,
    last_backup_at: payload.created_at,
    last_backup_id: backupRow.id,
    last_backup_status: "complete",
    last_backup_trigger: trigger,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  // 5. Prune old backups beyond retention limit
  await pruneOldBackups();

  return {
    id: backupRow.id,
    createdAt: backupRow.created_at,
    sizeBytes,
    tableCounts,
    trigger,
    status: "complete",
  };
}

// ---- PRUNE OLD BACKUPS ----
export async function pruneOldBackups(): Promise<number> {
  // Read retention config
  const { data: config } = await supabaseAdmin
    .from("backup_config")
    .select("retention_days")
    .eq("id", 1)
    .single();
  const retention = config?.retention_days ?? 30;

  // Get all backups ordered by created_at desc
  const { data: allBackups } = await supabaseAdmin
    .from("backups")
    .select("id, created_at")
    .order("created_at", { ascending: false });

  if (!allBackups || allBackups.length <= retention) return 0;

  // Delete everything beyond the retention limit
  const toDelete = allBackups.slice(retention).map((b: { id: string }) => b.id);
  const { error } = await supabaseAdmin.from("backups").delete().in("id", toDelete);
  if (error) {
    console.error("Prune old backups failed:", error.message);
    return 0;
  }
  return toDelete.length;
}

// ---- RESTORE BACKUP ----
export async function restoreBackup(backupId: string): Promise<{ restored: Record<string, number> }> {
  // 1. Read the backup
  const { data: backup, error: fetchError } = await supabaseAdmin
    .from("backups")
    .select("data, created_at")
    .eq("id", backupId)
    .single();

  if (fetchError) throw new Error(`Restore: backup not found: ${fetchError.message}`);
  if (!backup?.data) throw new Error("Restore: backup contains no data");

  const snapshot = backup.data as { tables: Record<string, unknown[]> };
  const restoredCounts: Record<string, number> = {};

  // 2. Delete existing data in FK-safe order (children first, parents last).
  //    Skip user_profiles (can't delete due to FK to auth.users — we'll upsert instead).
  //    Skip settings (single row with id=1 — we'll update it).
  for (const table of DELETE_ORDER) {
    if (table === "user_profiles" || table === "settings") continue;
    const { error } = await supabaseAdmin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      // Some tables may have no "id" column (unlikely in this schema, but be safe)
      console.warn(`Restore: could not clear ${table}: ${error.message}`);
    }
  }

  // 3. Re-insert data in FK-safe order (parents first, children last).
  for (const table of BACKUP_TABLES) {
    const rows = snapshot.tables[table] || [];
    if (rows.length === 0) {
      restoredCounts[table] = 0;
      continue;
    }

    if (table === "user_profiles") {
      // Upsert (can't delete due to auth.users FK)
      const { error } = await supabaseAdmin.from("user_profiles").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Restore: failed to upsert ${table}: ${error.message}`);
    } else if (table === "settings") {
      // Upsert single row (id=1)
      const { error } = await supabaseAdmin.from("settings").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Restore: failed to upsert ${table}: ${error.message}`);
    } else {
      // Batch insert (100 at a time)
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabaseAdmin.from(table).upsert(batch, { onConflict: "id" });
        if (error) throw new Error(`Restore: failed to insert ${table} (batch ${Math.floor(i / 100) + 1}): ${error.message}`);
      }
    }
    restoredCounts[table] = rows.length;
  }

  return { restored: restoredCounts };
}

// ---- LIST BACKUPS ----
export async function listBackups(limit = 50): Promise<BackupMeta[]> {
  const { data, error } = await supabaseAdmin
    .from("backups")
    .select("id, created_at, size_bytes, table_counts, trigger, status, error")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`List backups failed: ${error.message}`);
  return (data || []) as BackupMeta[];
}

// ---- DELETE BACKUP ----
export async function deleteBackup(backupId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("backups").delete().eq("id", backupId);
  if (error) throw new Error(`Delete backup failed: ${error.message}`);
}

// ---- GET BACKUP CONFIG ----
export async function getBackupConfig(): Promise<BackupConfig | null> {
  const { data, error } = await supabaseAdmin
    .from("backup_config")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) {
    // Table might not exist yet (schema not applied) — return defaults
    return {
      auto_backup_enabled: true,
      retention_days: 30,
      last_backup_at: null,
      last_backup_id: null,
      last_backup_status: null,
      last_backup_trigger: null,
    };
  }
  return data as BackupConfig;
}

// ---- UPDATE BACKUP CONFIG ----
export async function updateBackupConfig(patch: Partial<BackupConfig>): Promise<void> {
  const { error } = await supabaseAdmin
    .from("backup_config")
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`Update backup config failed: ${error.message}`);
}

// ---- CHECK IF AUTO-BACKUP IS DUE ----
// Returns true if last backup was >24h ago (or never), and auto-backup is enabled.
export function isAutoBackupDue(config: BackupConfig | null): boolean {
  if (!config?.auto_backup_enabled) return false;
  if (!config.last_backup_at) return true; // never backed up
  const last = new Date(config.last_backup_at).getTime();
  const hoursSince = (Date.now() - last) / (1000 * 60 * 60);
  return hoursSince >= 24;
}



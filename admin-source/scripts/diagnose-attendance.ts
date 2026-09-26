/**
 * Attendance module diagnostic — Supabase edition.
 *
 * Run with:  bun run scripts/diagnose-attendance.ts
 *        or:  npx tsx scripts/diagnose-attendance.ts
 *
 * Checks:
 *   1. Supabase env vars are set
 *   2. Supabase project is reachable
 *   3. All 5 attendance tables exist and are queryable
 *   4. Settings singleton row exists
 *   5. At least one employee exists (so login is possible)
 *   6. At least one permitted location exists (for GPS)
 *   7. Storage bucket 'attendance-photos' exists
 *   8. ATTENDANCE_STAFF_SESSION_SECRET env var
 *   9. sharp is installed (for photo compression)
 */

// Load .env.local manually — `tsx` doesn't auto-load it like Next.js does.
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

type Check = {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
};

const checks: Check[] = [];

function check(name: string, fn: () => { ok: boolean; detail: string; fix?: string }) {
  try {
    const result = fn();
    checks.push({ name, ...result });
  } catch (err) {
    checks.push({
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      fix: "See error detail above.",
    });
  }
}

// ---- 1. Supabase env vars ------------------------------------------------
check("Supabase environment variables set", () => {
  const url = process.env.NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY;
  const service = process.env.ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL");
  if (!anon) missing.push("NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY");
  if (!service) missing.push("ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    return {
      ok: false,
      detail: `Missing: ${missing.join(", ")}`,
      fix: "Create a Supabase project, run supabase/schema.sql, then add the env vars to .env.local. See ATTENDANCE.md.",
    };
  }
  return { ok: true, detail: `URL: ${url?.slice(0, 30)}...` };
});

// ---- 2-6. Supabase connectivity + data -----------------------------------
async function checkSupabase() {
  const { isSupabaseConfigured, getAttendanceAdminClient } = await import(
    "../src/lib/attendance/client"
  );

  if (!isSupabaseConfigured()) {
    checks.push({
      name: "Supabase connectivity",
      ok: false,
      detail: "Skipped — env vars not set.",
      fix: "Set the three Supabase env vars first.",
    });
    return;
  }

  const supabase = getAttendanceAdminClient();

  // 2. Ping the project (select from settings, which should always exist)
  try {
    const { error } = await supabase
      .from("attendance_settings")
      .select("id")
      .limit(1);
    if (error) {
      checks.push({
        name: "Supabase project reachable",
        ok: false,
        detail: error.message,
        fix: "Check NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL and ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY. Make sure you ran supabase/schema.sql.",
      });
      return;
    }
    checks.push({
      name: "Supabase project reachable",
      ok: true,
      detail: "Successfully queried attendance_settings table.",
    });
  } catch (err) {
    checks.push({
      name: "Supabase project reachable",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // 3. Each table queryable
  const tables = [
    "attendance_employees",
    "attendance_records",
    "attendance_locations",
    "attendance_settings",
    "attendance_audit_logs",
  ];
  for (const t of tables) {
    try {
      const { error } = await supabase.from(t).select("*").limit(1);
      if (error) throw new Error(error.message);
    } catch (err) {
      checks.push({
        name: `Table ${t} queryable`,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
        fix: `Run supabase/schema.sql to create the ${t} table.`,
      });
      return;
    }
  }
  checks.push({
    name: "All 5 attendance tables queryable",
    ok: true,
    detail: tables.join(", "),
  });

  // 4. Settings singleton
  const { data: settings } = await supabase
    .from("attendance_settings")
    .select("*")
    .eq("id", "singleton")
    .single();
  checks.push({
    name: "Attendance settings singleton exists",
    ok: !!settings,
    detail: settings
      ? `officeStartTime=${settings.office_start_time}, requirePhoto=${settings.require_photo}, requireLocation=${settings.require_location}`
      : "Singleton not found — run supabase/schema.sql (it inserts the singleton).",
  });

  // 5. Employees
  const { count: empCount } = await supabase
    .from("attendance_employees")
    .select("*", { count: "exact", head: true });
  checks.push({
    name: "At least one employee exists (for login)",
    ok: (empCount ?? 0) > 0,
    detail: `${empCount ?? 0} employees in the database.`,
    fix:
      (empCount ?? 0) > 0
        ? undefined
        : "Run supabase/seed.sql, or use the admin dashboard to add employees. Then reset their passwords.",
  });

  // 6. Locations
  const { count: locCount } = await supabase
    .from("attendance_locations")
    .select("*", { count: "exact", head: true });
  checks.push({
    name: "At least one permitted location exists (for GPS)",
    ok: (locCount ?? 0) > 0,
    detail: `${locCount ?? 0} permitted locations configured.`,
    fix:
      (locCount ?? 0) > 0
        ? undefined
        : "Run supabase/seed.sql, or add locations via the admin dashboard.",
  });

  // 7. Storage bucket
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw new Error(error.message);
    const bucket = (buckets ?? []).find((b) => b.name === "attendance-photos");
    checks.push({
      name: "Storage bucket 'attendance-photos' exists",
      ok: !!bucket,
      detail: bucket
        ? `Bucket exists (public: ${bucket.public})`
        : "Bucket not found",
      fix: bucket
        ? undefined
        : "Run supabase/schema.sql — it creates the storage bucket.",
    });
  } catch (err) {
    checks.push({
      name: "Storage bucket 'attendance-photos' exists",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---- 2-6. Supabase connectivity + data -----------------------------------
async function checkSupabaseSection() {
  try {
    await checkSupabase();
  } catch (err) {
    checks.push({
      name: "Supabase connectivity",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      fix: "Check Supabase env vars and network connectivity.",
    });
  }
}

// ---- 8. ATTENDANCE_STAFF_SESSION_SECRET ----------------------------------
check("ATTENDANCE_STAFF_SESSION_SECRET env var", () => {
  const val = process.env.ATTENDANCE_STAFF_SESSION_SECRET;
  if (!val) {
    return {
      ok: true,
      detail: "Not set — using sandbox fallback. MUST be set in production.",
      fix: "For production: add ATTENDANCE_STAFF_SESSION_SECRET=\"$(openssl rand -hex 32)\" to .env.local",
    };
  }
  if (val.length < 16) {
    return {
      ok: false,
      detail: `Secret is too short (${val.length} chars). Needs at least 16.`,
      fix: "Generate a strong secret: openssl rand -hex 32",
    };
  }
  return { ok: true, detail: `Set (${val.length} chars).` };
});

// ---- 9. sharp installed --------------------------------------------------
check("sharp installed (for photo compression)", () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("sharp");
    return { ok: true, detail: "sharp is installed and importable." };
  } catch {
    return {
      ok: false,
      detail: "sharp module not found. Photo upload will 500.",
      fix: "Run: bun install sharp",
    };
  }
});

// ---- Report ---------------------------------------------------------------
async function main() {
  await checkSupabaseSection();

  console.log("\n=== Attendance Module Diagnostic (Supabase) ===\n");
  let allOk = true;
  for (const c of checks) {
    const icon = c.ok ? "✅" : "❌";
    console.log(`${icon} ${c.name}`);
    console.log(`    ${c.detail}`);
    if (c.fix) console.log(`    → FIX: ${c.fix}`);
    console.log();
    if (!c.ok) allOk = false;
  }

  if (allOk) {
    console.log("=== All checks passed ===");
  } else {
    console.log("=== Some checks failed — see above ===");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Diagnostic crashed:", err);
  process.exit(1);
});

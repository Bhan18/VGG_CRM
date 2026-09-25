// Diagnostic: reproduce the BM login + customers failure.
// Usage: node scripts/diag-bm.cjs <employeeCode> <password>
// Prints only diagnostics, never secrets.
const fs = require("fs");
const path = require("path");

function loadEnv(f) {
  const out = {};
  const text = fs.readFileSync(f, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

(async () => {
  const [code, password] = process.argv.slice(2);
  if (!code || !password) {
    console.log("usage: node scripts/diag-bm.cjs <employeeCode> <password>");
    process.exit(1);
  }
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  const { createClient } = require("@supabase/supabase-js");
  const bcrypt = require("bcryptjs");

  const att = createClient(env.NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL, env.ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("== 1. ATTENDANCE login ==");
  const { data: emp, error: empErr } = await att
    .from("attendance_employees")
    .select("id, employee_code, name, role, status, password_hash")
    .eq("employee_code", code.trim())
    .single();
  if (empErr || !emp) {
    console.log("LOGIN FAIL: employee not found. Supabase says:", empErr?.message);
    process.exit(0);
  }
  console.log("found:", emp.employee_code, "|", emp.name, "| role =", emp.role, "| status =", emp.status);
  const ok = emp.password_hash ? bcrypt.compareSync(password, emp.password_hash) : false;
  console.log("password", ok ? "OK" : "MISMATCH");
  if (emp.status !== "ACTIVE") console.log("BLOCKER: employee not ACTIVE");
  if (emp.role !== "BRANCH_MANAGER") console.log(`BLOCKER: role is '${emp.role}', need 'BRANCH_MANAGER' for /api/bm/*`);

  console.log("== 2. MAIN project tables ==");
  const main = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // payments columns?
  const payProbe = await main.from("payments").select("id").limit(1);
  if (payProbe.error) {
    console.log("payments table error:", payProbe.error.message);
  } else {
    const colProbe = await main.from("payments").select("status, proof_urls, recorded_by").limit(1);
    if (colProbe.error) console.log("MIGRATION MISSING — approval columns query failed:", colProbe.error.message);
    else console.log("approval columns present: status/proof_urls/recorded_by OK");
  }

  const plots = await main.from("plots").select("id, status, customer_id").limit(5000);
  if (plots.error) {
    console.log("plots query error:", plots.error.message);
  } else {
    const byStatus = {};
    let linked = 0;
    for (const p of plots.data ?? []) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      if (p.customer_id && ["booked", "reserved", "sold"].includes(p.status)) linked++;
    }
    console.log("plots by status:", JSON.stringify(byStatus));
    console.log("recordable plots with customer linked:", linked);
    if (linked === 0) console.log("BLOCKER: no booked/reserved/sold plots with a customer -> empty list is CORRECT");
  }

  const cust = await main.from("customers").select("id", { count: "exact", head: true });
  console.log("customers count:", cust.count ?? ("err: " + cust.error?.message));

  const bucket = await main.storage.getBucket("payment-proofs");
  console.log("payment-proofs bucket:", bucket.data ? "exists" : "MISSING (" + bucket.error?.message + ")");
})().catch((e) => console.log("SCRIPT ERROR:", e.message));

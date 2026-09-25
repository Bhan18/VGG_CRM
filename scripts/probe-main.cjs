// Focused probe of the MAIN project: exact errors + table inventory.
const fs = require("fs");
const path = require("path");
const env = {};
const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.length > 1 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
    v = v.slice(1, -1);
  }
  env[m[1]] = v;
}
function refOf(url) {
  const m = String(url || "").match(/https:\/\/([a-z0-9]+)\./);
  return m ? m[1] : "(unparseable)";
}
(async () => {
  console.log("ATTENDANCE URL ref:", refOf(env.NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL));
  const { createClient } = require("@supabase/supabase-js");
  const main = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const p1 = await main.from("plots").select("id").limit(1);
  console.log("plots probe:", p1.error ? JSON.stringify({ message: p1.error.message, code: p1.error.code, details: p1.error.details, hint: p1.error.hint }) : `OK (${(p1.data || []).length} row(s))`);

  // Table inventory via information_schema (readable to service_role)
  const inv = await main.schema("information_schema").from("tables").select("table_name").eq("table_schema", "public").limit(200);
  if (inv.error) {
    console.log("inventory error:", inv.error.message);
  } else {
    const names = (inv.data || []).map((t) => t.table_name).sort();
    console.log("public tables (" + names.length + "):", names.join(", "));
  }
})().catch((e) => console.log("SCRIPT ERROR:", e.message));

// Verify the BM customers data path end-to-end (mirrors /api/bm/customers).
// Exit 0 + "WORKING" if the list would load, else names the blocker.
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
  return m ? m[1] : null;
}
function roleOf(key) {
  try {
    return JSON.parse(Buffer.from(String(key).split(".")[1], "base64").toString()).ref;
  } catch {
    return null;
  }
}
(async () => {
  const fail = (msg) => {
    console.log("NOT WORKING:", msg);
    process.exit(1);
  };
  const urlRef = refOf(env.NEXT_PUBLIC_SUPABASE_URL);
  const svcRef = roleOf(env.SUPABASE_SERVICE_ROLE_KEY);
  if (!urlRef || !svcRef) fail("env vars missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  if (urlRef !== svcRef) fail(`URL points at project ${urlRef} but service key belongs to ${svcRef} — align both to the admin project`);

  const { createClient } = require("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const plots = await sb.from("plots").select("*").in("status", ["booked", "reserved", "sold"]).not("customer_id", "is", null);
  if (plots.error) fail("plots query: " + plots.error.message);
  const rows = plots.data ?? [];
  if (rows.length === 0) fail("zero recordable plots with customers linked");

  const plotIds = rows.map((p) => p.id);
  const pay = await sb.from("payments").select("plot_id, amount").in("plot_id", plotIds).eq("status", "approved");
  if (pay.error) fail("payments query (migration?): " + pay.error.message);

  const custIds = [...new Set(rows.map((p) => p.customer_id))];
  const cust = await sb.from("customers").select("id, name, phone").in("id", custIds);
  if (cust.error) fail("customers query: " + cust.error.message);

  const paidByPlot = new Map();
  for (const x of pay.data ?? []) paidByPlot.set(x.plot_id, (paidByPlot.get(x.plot_id) ?? 0) + (x.amount || 0));
  let withDue = 0;
  for (const p of rows) {
    const paid = paidByPlot.get(p.id) ?? 0;
    if (Math.max(0, (p.total_price ?? 0) - paid) > 0) withDue++;
  }
  const bucket = await sb.storage.getBucket("payment-proofs");
  console.log(`WORKING: project ${urlRef} | customers=${(cust.data ?? []).length} | recordable plots=${rows.length} | plots with dues=${withDue}`);
  console.log("payment-proofs bucket:", bucket.data ? "exists" : "MISSING (run migration)");
})().catch((e) => {
  console.log("NOT WORKING:", e.message);
  process.exit(1);
});

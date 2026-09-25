// Probe the project behind the ANON key (biqt...) — is IT the real admin DB?
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
  const { createClient } = require("@supabase/supabase-js");
  // Reconstruct this project's URL from the anon key's own ref claim.
  const payload = JSON.parse(Buffer.from(env.NEXT_PUBLIC_SUPABASE_ANON_KEY.split(".")[1], "base64").toString());
  const url = `https://${payload.ref}.supabase.co`;
  console.log("probing anon-key project:", payload.ref);
  const sb = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const t of ["plots", "customers", "payments"]) {
    const r = await sb.from(t).select("id", { count: "exact", head: true });
    console.log(t, "->", r.error ? "ERR: " + r.error.message : "OK, count=" + r.count);
  }
  // Do approval columns exist on payments here?
  const c = await sb.from("payments").select("status, proof_urls, recorded_by").limit(1);
  console.log("approval columns:", c.error ? "MISSING/ERR: " + c.error.message : "PRESENT");
  const s = await sb.from("plots").select("id,status,customer_id").limit(5000);
  if (s.error) {
    console.log("plots detail: ERR", s.error.message);
  } else {
    const byStatus = {};
    let linked = 0;
    for (const p of s.data ?? []) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      if (p.customer_id && ["booked", "reserved", "sold"].includes(p.status)) linked++;
    }
    console.log("plots by status:", JSON.stringify(byStatus), "| recordable+linked:", linked);
  }
})().catch((e) => console.log("SCRIPT ERROR:", e.message));

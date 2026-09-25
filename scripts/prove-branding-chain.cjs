// Proves website-save -> staff-DB -> staff-app-read chain.
// Writes a test tagline via the exact upsert the website PUT performs,
// then restores the original. Prints each step.
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
(async () => {
  const { createClient } = require("@supabase/supabase-js");
  const att = createClient(env.NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL, env.ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const before = await att.from("agent_settings").select("app_name, tagline").eq("id", 1).maybeSingle();
  console.log("before:", JSON.stringify(before.data));

  const probe = "chain-test-" + Date.now();
  const w1 = await att.from("agent_settings").update({ tagline: probe, updated_at: new Date().toISOString() }).eq("id", 1);
  console.log("write (website PUT shape):", w1.error ? "FAIL " + w1.error.message : "OK");

  const r = await fetch("http://localhost:3001/api/agent/branding").then((x) => x.json());
  console.log("staff app reads:", JSON.stringify(r), "| match:", r.tagline === probe ? "YES-CHAIN-PROVEN" : "NO");

  const w2 = await att
    .from("agent_settings")
    .update({ tagline: before.data?.tagline ?? null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  console.log("restore:", w2.error ? "FAIL " + w2.error.message : "OK");
})().catch((e) => console.log("SCRIPT ERROR:", e.message));

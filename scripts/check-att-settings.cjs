// Check agent_settings in the ATTENDANCE project (rllw).
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
  const { data, error } = await att.from("agent_settings").select("*").eq("id", 1).maybeSingle();
  if (error) console.log("ERR:", error.message);
  else console.log("rllw.agent_settings:", JSON.stringify(data));
})().catch((e) => console.log("SCRIPT ERROR:", e.message));

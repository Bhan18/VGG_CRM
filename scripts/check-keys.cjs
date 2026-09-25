// Prints ONLY key roles + project refs (no secrets).
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
console.log("NEXT_PUBLIC_SUPABASE_URL ref:", refOf(env.NEXT_PUBLIC_SUPABASE_URL));
for (const k of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  try {
    const payload = JSON.parse(Buffer.from(env[k].split(".")[1], "base64").toString());
    console.log(k, "-> role:", payload.role, "| ref:", payload.ref);
  } catch (e) {
    console.log(k, "-> UNDECODABLE");
  }
}

// Prints ONLY key roles + project refs for ATTENDANCE vars (no secrets).
const fs = require("fs");
const path = require("path");
for (const f of [".env", ".env.local"]) {
  const fp = path.join("C:\\Users\\paris\\Desktop\\admin_app", f);
  try {
    if (!fs.existsSync(fp)) continue;
  } catch (e) { continue; }
  const text = fs.readFileSync(fp, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL|NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY|ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length > 1 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
      v = v.slice(1, -1);
    }
    if (!v || v.includes("YOUR") || v.includes("example") || v.includes("...")) {
      console.log(f, "::", m[1], "-> (missing/placeholder)");
      continue;
    }
    if (v.startsWith("eyJ")) {
      try {
        const p = JSON.parse(Buffer.from(v.split(".")[1], "base64").toString());
        console.log(f, "::", m[1], "-> role:", p.role, "| ref:", p.ref);
      } catch (e) {
        console.log(f, "::", m[1], "-> (undecodable)");
      }
    } else {
      const rm = v.match(/https:\/\/([a-z0-9]+)\./);
      console.log(f, "::", m[1], "-> project-ref:", rm ? rm[1] : "(unparseable)");
    }
  }
}

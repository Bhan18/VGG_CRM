// Prints ONLY key roles + project refs for admin_app env (no secrets).
const fs = require("fs");
const path = require("path");
for (const f of [".env", ".env.local", ".env.example"]) {
  const fp = path.join("C:\\Users\\paris\\Desktop\\admin_app", f);
  if (!fs.existsSync(fp)) continue;
  const text = fs.readFileSync(fp, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length > 1 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
      v = v.slice(1, -1);
    }
    if (!v || v.includes("your-") || v.includes("example")) {
      console.log(f, "::", m[1], "-> (placeholder)");
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
      console.log(f, "::", m[1], "-> project-ref:", rm ? rm[1] : v.slice(0, 20));
    }
  }
}

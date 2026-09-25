// One-time repair: point agents_app MAIN project vars at biqt (admin DB).
// Keeps all ATTENDANCE_* vars untouched. Backs up .env.local first.
// Prints refs only, never secret values.
const fs = require("fs");
const AGENTS = "C:\\Users\\paris\\Desktop\\agents_app\\.env.local";
const ADMIN = "C:\\Users\\paris\\Desktop\\admin_app\\.env.local";

function loadEnv(f) {
  const out = {};
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length > 1 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}
function refOfJwt(key) {
  try {
    return JSON.parse(Buffer.from(String(key).split(".")[1], "base64").toString()).ref;
  } catch {
    return null;
  }
}

const admin = loadEnv(ADMIN);
const agentsLines = fs.readFileSync(AGENTS, "utf8").split(/\r?\n/);

// Sanity: admin env must be self-consistent (all biqt) before copying.
const aUrl = admin.NEXT_PUBLIC_SUPABASE_URL;
const aSvcRef = refOfJwt(admin.SUPABASE_SERVICE_ROLE_KEY);
const aUrlRef = (aUrl.match(/https:\/\/([a-z0-9]+)\./) || [])[1];
if (aUrlRef !== aSvcRef) {
  console.log("REFUSE: admin_app env itself is inconsistent. Aborting.");
  process.exit(1);
}

fs.copyFileSync(AGENTS, AGENTS + ".bak");
console.log("backup written to .env.local.bak");

const want = {
  NEXT_PUBLIC_SUPABASE_URL: admin.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: admin.SUPABASE_SERVICE_ROLE_KEY,
};
const out = agentsLines.map((line) => {
  const m = line.match(/^(\s*NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=/);
  if (!m) return line;
  const key = m[1].trim();
  const quote = line.includes('"') ? '"' : "";
  return `${key}=${quote}${want[key]}${quote}`;
});
fs.writeFileSync(AGENTS, out.join("\n"));
console.log("agents .env.local MAIN vars now point at project:", aUrlRef);
console.log("ATTENDANCE_* vars untouched. Restart dev server / redeploy to apply.");

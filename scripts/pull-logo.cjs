// Download the real logo (DB branding) to public/logo-vgg.png and
// regenerate agent-icons PNGs from it. Usage: node scripts/pull-logo.cjs
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
  const sharp = require("sharp");
  const att = createClient(env.NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL, env.ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await att.from("agent_settings").select("app_name, logo_url").eq("id", 1).maybeSingle();
  if (error || !data?.logo_url) {
    console.log("no DB logo to pull");
    process.exit(1);
  }
  console.log("app_name:", data.app_name);
  const res = await fetch(data.logo_url);
  if (!res.ok) {
    console.log("download failed:", res.status);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const outPng = path.join(__dirname, "..", "public", "logo-vgg.png");
  fs.writeFileSync(outPng, buf);
  console.log("saved logo-vgg.png", buf.length + "b");

  const OUT = path.join(__dirname, "..", "public", "agent-icons");
  const PAPER = { r: 250, g: 248, b: 243, alpha: 1 };
  for (const [file, size] of [["favicon-32.png", 32], ["icon-192.png", 192], ["icon-512.png", 512]]) {
    const out = await sharp(buf).resize(size, size, { fit: "contain", background: PAPER }).png().toBuffer();
    fs.writeFileSync(path.join(OUT, file), out);
    console.log("wrote", file, out.length + "b");
  }
  const inner = await sharp(buf).resize(368, 368, { fit: "contain" }).png().toBuffer();
  const maskable = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 26, g: 92, b: 71, alpha: 1 } },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUT, "icon-maskable-512.png"), maskable);
  console.log("wrote icon-maskable-512.png", maskable.length + "b");
})().catch((e) => {
  console.log("FAILED:", e.message);
  process.exit(1);
});

// Regenerate PWA/static icons from public/logo.svg.
// Usage: node scripts/gen-icons.cjs
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public", "logo.svg");
const OUT = path.join(ROOT, "public", "agent-icons");
const PAPER = { r: 250, g: 248, b: 243, alpha: 1 };

(async () => {
  const svg = fs.readFileSync(SRC);
  const jobs = [
    // Favicon + app icons on paper background (matches icon routes).
    { file: "favicon-32.png", size: 32, bg: PAPER },
    { file: "icon-192.png", size: 192, bg: PAPER },
    { file: "icon-512.png", size: 512, bg: PAPER },
    // Maskable: full-bleed artwork with centered mark (safe zone).
    { file: "icon-maskable-512.png", size: 512, bg: null },
  ];
  for (const j of jobs) {
    let img = sharp(svg).resize(j.size, j.size, {
      fit: j.bg ? "contain" : "cover",
      background: j.bg ?? { r: 26, g: 92, b: 71, alpha: 1 },
    });
    if (!j.bg) {
      // Re-render the mark centered at 80% for the maskable safe zone.
      const inner = await sharp(svg)
        .resize(Math.round(j.size * 0.72), Math.round(j.size * 0.72), { fit: "contain" })
        .png()
        .toBuffer();
      img = sharp({
        create: { width: j.size, height: j.size, channels: 4, background: { r: 26, g: 92, b: 71, alpha: 1 } },
      }).composite([{ input: inner, gravity: "center" }]);
    }
    const buf = await img.png().toBuffer();
    fs.writeFileSync(path.join(OUT, j.file), buf);
    console.log("wrote", j.file, buf.length + "b");
  }
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

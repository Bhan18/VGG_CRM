import sharp from "sharp";
import { fetchLogoBuffer, ICON_CACHE_HEADERS, pngResponse } from "@/lib/agent/logo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIZE = 512;
const LOGO_SIZE = 358;

export async function GET() {
  const src = await fetchLogoBuffer();
  if (!src) return new Response(null, { status: 404 });
  try {
    const logo = await sharp(src.buffer)
      .resize(LOGO_SIZE, LOGO_SIZE, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    const background = await sharp({
      create: { width: SIZE, height: SIZE, channels: 4, background: "#faf8f3" },
    }).png().toBuffer();
    const png = await sharp(background)
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toBuffer();
    return pngResponse(png, ICON_CACHE_HEADERS);
  } catch {
    return new Response(null, { status: 404 });
  }
}

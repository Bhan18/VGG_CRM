import sharp from "sharp";
import { fetchLogoBuffer, ICON_CACHE_HEADERS, pngResponse } from "@/lib/agent/logo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const src = await fetchLogoBuffer();
  if (!src) return new Response(null, { status: 404 });
  try {
    const png = await sharp(src.buffer)
      .resize(192, 192, { fit: "contain", background: { r: 250, g: 248, b: 243, alpha: 1 } })
      .png()
      .toBuffer();
    return pngResponse(png, ICON_CACHE_HEADERS);
  } catch {
    return new Response(null, { status: 404 });
  }
}

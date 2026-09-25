import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { requireBranchManager } from "@/lib/agent/bm-guard";
import { getServerSupabase } from "@/lib/agent/server-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/bm/upload — proof-of-payment image upload (multipart `file`).
// Compressed server-side, stored in the private `payment-proofs` bucket
// (main project). Returns { path } to attach to the payment.

const BUCKET = "payment-proofs";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB per image

export async function POST(req: NextRequest) {
  const gate = await requireBranchManager(req);
  if (!gate.authorized) return gate.response;

  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5MB or smaller." }, { status: 400 });
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const compressed = await sharp(input)
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    const path = `proofs/${Date.now()}-${randomUUID()}.jpg`;
    let { error } = await sb.storage.from(BUCKET).upload(path, compressed, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error && /bucket|not found/i.test(error.message)) {
      const created = await sb.storage.createBucket(BUCKET, { public: false });
      if (created.error && !/exist|duplicate|conflict|already/i.test(created.error.message)) {
        throw new Error(created.error.message);
      }
      const retry = await sb.storage.from(BUCKET).upload(path, compressed, {
        contentType: "image/jpeg",
        upsert: false,
      });
      error = retry.error;
    }
    if (error) throw new Error(error.message);

    return NextResponse.json({ path, bytes: compressed.byteLength });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 },
    );
  }
}

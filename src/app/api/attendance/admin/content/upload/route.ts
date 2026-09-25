import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { getServerSupabase } from "@/lib/agent/server-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// Admin content uploads (main Supabase project, service-role key).
// Multipart form: `file` + `folder` (covers | files | videos | thumbs).
// Images are compressed; PDFs/videos pass through. The public
// `agent-content` bucket is created on demand. Returns { url, bytes }.

const BUCKET = "agent-content";

const FOLDERS = {
  covers: { kinds: ["image"], maxBytes: 10 * 1024 * 1024 },
  thumbs: { kinds: ["image"], maxBytes: 10 * 1024 * 1024 },
  files: { kinds: ["pdf", "image"], maxBytes: 25 * 1024 * 1024 },
  videos: { kinds: ["video"], maxBytes: 100 * 1024 * 1024 },
} as const;

function kindOf(mime: string): "image" | "pdf" | "video" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "video";
  return null;
}

function extFor(mime: string, name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  if (m?.[1] && ["jpg", "jpeg", "png", "webp", "pdf", "mp4", "mov", "webm"].includes(m[1])) {
    return m[1] === "jpeg" ? "jpg" : m[1]!;
  }
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime.startsWith("image/")) return "jpg";
  return "bin";
}

function contentTypeFor(ext: string, mime: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    pdf: "application/pdf",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  };
  return map[ext] ?? mime;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin.authorized) return admin.response;

  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Content service not configured." }, { status: 503 });
  }

  let file: File | null = null;
  let folder = "";
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
    folder = String(form.get("folder") ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const spec = FOLDERS[folder as keyof typeof FOLDERS];
  if (!file || !spec) {
    return NextResponse.json({ error: "file + valid folder (covers, files, videos, thumbs) required." }, { status: 400 });
  }

  const kind = kindOf(file.type);
  if (!kind || !(spec.kinds as readonly string[]).includes(kind)) {
    const want =
      folder === "videos" ? "a video file" : folder === "files" ? "a PDF or image" : "an image";
    return NextResponse.json({ error: `Please choose ${want}.` }, { status: 400 });
  }
  if (file.size > spec.maxBytes) {
    return NextResponse.json(
      { error: `File must be ${Math.round(spec.maxBytes / 1024 / 1024)}MB or smaller.` },
      { status: 400 },
    );
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const ext = extFor(file.type, file.name || "file");
    let payload: Buffer;
    let contentType = contentTypeFor(ext, file.type);

    if (kind === "image") {
      payload = await sharp(input)
        .resize({ width: 1280, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      contentType = "image/jpeg";
    } else {
      payload = input;
    }

    const path = `${folder}/${Date.now()}-${randomBytes(6).toString("hex")}.${kind === "image" ? "jpg" : ext}`;

    let { error } = await sb.storage.from(BUCKET).upload(path, payload, {
      contentType,
      upsert: false,
    });
    if (error && /bucket|not found/i.test(error.message)) {
      const created = await sb.storage.createBucket(BUCKET, { public: true });
      if (created.error && !/exist|duplicate|conflict|already/i.test(created.error.message)) {
        throw new Error(created.error.message);
      }
      const retry = await sb.storage.from(BUCKET).upload(path, payload, {
        contentType,
        upsert: false,
      });
      error = retry.error;
    }
    if (error) throw new Error(error.message);

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl, bytes: payload.byteLength });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 },
    );
  }
}
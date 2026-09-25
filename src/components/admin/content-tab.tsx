"use client";

// Admin content — add, edit, publish/unpublish, pin, delete posts,
// brochures and videos shown in the staff Content tab.
// File uploads are out of scope: paste hosted file/image URLs.
// Backed by /api/attendance/admin/content (main Supabase project).

import { useState } from "react";
import {
  FileText,
  BookOpen,
  PlayCircle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Pin,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminFetch } from "@/hooks/admin/use-admin-data";
import {
  SkeletonList,
  EmptyState,
  ErrorState,
} from "@/components/agent/ui-primitives";
import { ConfirmSheet } from "./employees-tab";
import { FileDrop, getVideoDuration } from "./file-drop";

type SubTab = "posts" | "brochures" | "videos";

type Post = {
  id: string;
  title: string;
  body: string | null;
  cover_image_url: string | null;
  attachment_url: string | null;
  published_at: string | null;
  pinned: boolean;
};

type Brochure = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  published_at: string | null;
};

type Video = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
};

type ContentData = {
  posts: Post[];
  brochures: Brochure[];
  videos: Video[];
};

type Item = (Post | Brochure | Video) & { id: string; title: string; published_at: string | null };

const inputCls =
  "w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]";

export function ContentAdminTab() {
  const { data, loading, error, reload } = useAdminFetch<ContentData>(
    "/api/attendance/admin/content",
  );
  const [sub, setSub] = useState<SubTab>("posts");
  const [form, setForm] = useState<{ type: SubTab; item?: Item } | null>(null);
  const [deleting, setDeleting] = useState<{ type: SubTab; item: Item } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function togglePublish(type: SubTab, item: Item) {
    setBusyId(item.id);
    try {
      const res = await fetch("/api/attendance/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type,
          id: item.id,
          published_at: item.published_at ? null : new Date().toISOString(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not update item.");
        return;
      }
      toast.success(item.published_at ? "Unpublished" : "Published");
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function togglePin(item: Post) {
    setBusyId(item.id);
    try {
      const res = await fetch("/api/attendance/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "posts", id: item.id, pinned: !item.pinned }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not update item.");
        return;
      }
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(
        `/api/attendance/admin/content?type=${deleting.type}&id=${deleting.item.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not delete item.");
        return;
      }
      toast.success("Deleted");
      setDeleting(null);
      reload();
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading && !data) return <SkeletonList count={4} height={96} />;
  if (error && !data) {
    return <ErrorState title="Couldn't load content" description={error} onRetry={reload} />;
  }

  const items: Item[] = (data?.[sub] ?? []) as Item[];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-[color-mix(in_srgb,var(--brand-emerald)_7%,white)] p-1">
          {([
            { id: "posts", label: "Posts", icon: FileText },
            { id: "brochures", label: "Brochures", icon: BookOpen },
            { id: "videos", label: "Videos", icon: PlayCircle },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSub(id)}
              className="agent-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background: sub === id ? "var(--brand-emerald)" : "transparent",
                color: sub === id ? "#fff" : "var(--brand-ink)",
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setForm({ type: sub })}
          className="agent-press flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--brand-emerald)" }}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {!data || items.length === 0 ? (
        <EmptyState
          icon={sub === "posts" ? FileText : sub === "brochures" ? BookOpen : PlayCircle}
          title={`No ${sub} yet`}
          description="Tap Add to create the first one."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="agent-card flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{item.title}</span>
                  {(item as Post).pinned === true && (
                    <span
                      className="flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ background: "color-mix(in srgb, var(--brand-gold) 18%, white)", color: "#8a6d24" }}
                    >
                      <Pin className="h-2.5 w-2.5" /> Pinned
                    </span>
                  )}
                  {item.published_at ? (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: "color-mix(in srgb, var(--brand-emerald) 12%, white)", color: "var(--brand-emerald)" }}>
                      Live
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold text-black/50">
                      Draft
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-[var(--brand-ink)]/55">
                  {"body" in item && item.body ? item.body : "description" in item && item.description ? item.description : "—"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {sub === "posts" && (
                  <button
                    onClick={() => void togglePin(item as Post)}
                    disabled={busyId === item.id}
                    title={(item as Post).pinned ? "Unpin" : "Pin to top"}
                    className="agent-press flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-50"
                    style={{
                      background: (item as Post).pinned ? "color-mix(in srgb, var(--brand-gold) 18%, white)" : "rgba(0,0,0,0.05)",
                      color: (item as Post).pinned ? "#8a6d24" : "rgba(0,0,0,0.45)",
                    }}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => void togglePublish(sub, item)}
                  disabled={busyId === item.id}
                  title={item.published_at ? "Unpublish" : "Publish"}
                  className="agent-press flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-50"
                  style={{
                    background: item.published_at ? "color-mix(in srgb, var(--brand-emerald) 10%, white)" : "rgba(0,0,0,0.05)",
                    color: item.published_at ? "var(--brand-emerald)" : "rgba(0,0,0,0.45)",
                  }}
                >
                  {item.published_at ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setForm({ type: sub, item })}
                  title="Edit"
                  className="agent-press flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 text-black/60"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleting({ type: sub, item })}
                  title="Delete"
                  className="agent-press flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <ContentForm
          type={form.type}
          item={form.item}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); reload(); }}
        />
      )}
      {deleting && (
        <ConfirmSheet
          title="Delete item?"
          body={`Delete "${deleting.item.title}"? Staff will no longer see it. This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void onDelete()}
        />
      )}
    </div>
  );
}

function ContentForm({
  type,
  item,
  onClose,
  onSaved,
}: {
  type: SubTab;
  item?: Item;
  onClose: () => void;
  onSaved: () => void;
}) {
  const p = item as Post | undefined;
  const b = item as Brochure | undefined;
  const v = item as Video | undefined;
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(p?.body ?? b?.description ?? v?.description ?? "");
  const [cover, setCover] = useState(p?.cover_image_url ?? b?.cover_image_url ?? "");
  const [file, setFile] = useState(
    type === "posts" ? (p?.attachment_url ?? "") : type === "brochures" ? (b?.file_url ?? "") : (v?.video_url ?? ""),
  );
  const [fileBytes, setFileBytes] = useState<number | null>(b?.file_size_bytes ?? null);
  const [thumb, setThumb] = useState(v?.thumbnail_url ?? "");
  const [durationSecs, setDurationSecs] = useState<number | null>(v?.duration_seconds ?? null);
  const [published, setPublished] = useState(!!item?.published_at);
  const [pinned, setPinned] = useState(p?.pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { type, title: title.trim() };
      if (type === "posts") {
        payload.body = body.trim() || null;
        payload.cover_image_url = cover.trim() || null;
        payload.attachment_url = file.trim() || null;
        payload.pinned = pinned;
      } else if (type === "brochures") {
        payload.description = body.trim() || null;
        payload.cover_image_url = cover.trim() || null;
        payload.file_url = file.trim() || null;
        payload.file_size_bytes = fileBytes;
      } else {
        payload.description = body.trim() || null;
        payload.thumbnail_url = thumb.trim() || (cover.trim() || null);
        payload.video_url = file.trim() || null;
        payload.duration_seconds = durationSecs;
      }
      payload.published_at = published ? item?.published_at ?? new Date().toISOString() : null;

      const res = await fetch("/api/attendance/admin/content", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(item ? { ...payload, id: item.id } : payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error ?? "Could not save item.");
        return;
      }
      toast.success(item ? "Item updated" : "Item created");
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">
            {item ? "Edit" : "Add"} {type === "posts" ? "post" : type === "brochures" ? "brochure" : "video"}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="Title *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={inputCls} />
        </Field>
        <div className="mt-3">
          <Field label={type === "posts" ? "Body" : "Description"}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Write something..." className={`${inputCls} resize-none`} />
          </Field>
        </div>
        <div className="mt-3">
          {type === "videos" ? (
            <FileDrop
              label="Video file *"
              accept="video/*"
              maxMB={100}
              uploadUrl="/api/attendance/admin/content/upload"
              folder="videos"
              kind="video"
              value={file || null}
              onFileSelected={(f) => void getVideoDuration(f).then((d) => { if (d != null) setDurationSecs(d); })}
              onUploaded={(url) => setFile(url)}
              onClear={() => { setFile(""); setDurationSecs(null); }}
              hint="Drag & drop or choose a video · up to 100MB"
            />
          ) : (
            <FileDrop
              label={type === "posts" ? "Attachment (PDF / image)" : "Brochure file (PDF) *"}
              accept={type === "posts" ? ".pdf,image/*" : ".pdf"}
              maxMB={25}
              uploadUrl="/api/attendance/admin/content/upload"
              folder="files"
              kind="file"
              value={file || null}
              onUploaded={(url, bytes) => { setFile(url); setFileBytes(bytes); }}
              onClear={() => { setFile(""); setFileBytes(null); }}
              hint="Drag & drop or choose a file · up to 25MB"
            />
          )}
          {type === "videos" && durationSecs != null && (
            <div className="mt-1 text-[10px] tabular-nums text-[var(--brand-ink)]/45">
              Duration: {Math.floor(durationSecs / 60)}:{String(durationSecs % 60).padStart(2, "0")}
            </div>
          )}
          {type === "brochures" && fileBytes != null && file && (
            <div className="mt-1 text-[10px] tabular-nums text-[var(--brand-ink)]/45">
              Size: {(fileBytes / 1024 / 1024).toFixed(1)} MB
            </div>
          )}
        </div>
        {type === "videos" ? (
          <div className="mt-3">
            <FileDrop
              label="Thumbnail image"
              accept="image/*"
              maxMB={10}
              uploadUrl="/api/attendance/admin/content/upload"
              folder="thumbs"
              kind="image"
              value={thumb || null}
              onUploaded={(url) => setThumb(url)}
              onClear={() => setThumb("")}
            />
          </div>
        ) : (
          <div className="mt-3">
            <FileDrop
              label="Cover image"
              accept="image/*"
              maxMB={10}
              uploadUrl="/api/attendance/admin/content/upload"
              folder="covers"
              kind="image"
              value={cover || null}
              onUploaded={(url) => setCover(url)}
              onClear={() => setCover("")}
            />
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 accent-[var(--brand-emerald)]" />
            Published (visible to staff)
          </label>
          {type === "posts" && (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 accent-[var(--brand-emerald)]" />
              Pin to top
            </label>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="agent-press mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--brand-emerald)" }}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Saving..." : item ? "Save changes" : "Create"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--brand-ink)]/70">{label}</label>
      {children}
    </div>
  );
}
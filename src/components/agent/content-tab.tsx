"use client";

// Content hub — posts, brochures, videos. Read-only.

import {
  FileText,
  BookOpen,
  PlayCircle,
  Pin,
  Download,
  ExternalLink,
  Clock,
} from "lucide-react";
import {
  useContentPosts,
  useContentBrochures,
  useContentVideos,
} from "@/hooks/agent/use-agent-data";
import { useAgentNav } from "@/hooks/agent/use-agent-nav";
import { Skeleton } from "@/components/ui/skeleton";

type SubTab = "posts" | "brochures" | "videos";

export function ContentTab() {
  const { contentTab: sub, setContentTab: setSub } = useAgentNav();
  return (
    <div className="px-4 pb-6 pt-3">
      <div className="mb-4 flex gap-1 rounded-xl bg-[color-mix(in_srgb,var(--brand-emerald)_7%,white)] p-1">
        {([
          { id: "posts", label: "Posts", icon: FileText },
          { id: "brochures", label: "Brochures", icon: BookOpen },
          { id: "videos", label: "Videos", icon: PlayCircle },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors"
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

      {sub === "posts" && <PostsList />}
      {sub === "brochures" && <BrochuresList />}
      {sub === "videos" && <VideosList />}
    </div>
  );
}

function PostsList() {
  const { data, isLoading, error } = useContentPosts();
  if (isLoading) return <LoadingSkeletons />;
  if (error) return <ErrorState />;
  if (!data || data.length === 0) return <EmptyState icon={FileText} label="No posts yet" />;

  const sorted = [...data].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return (
    <div className="flex flex-col gap-3">
      {sorted.map((p) => (
        <article key={p.id} className="agent-card overflow-hidden">
          {p.cover_image_url && (
            <div className="aspect-[16/9] w-full overflow-hidden bg-[var(--brand-emerald-tint)]">
              <img
                src={p.cover_image_url}
                alt={p.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="p-4">
            <div className="flex items-start gap-2">
              {p.pinned && (
                <span
                  className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: "color-mix(in srgb, var(--brand-gold) 18%, white)",
                    color: "#8a6d24",
                  }}
                >
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
              <h3 className="flex-1 text-sm font-semibold leading-tight">{p.title}</h3>
            </div>
            {p.body && (
              <p className="mt-2 line-clamp-3 text-xs text-[var(--brand-ink)]/65 leading-relaxed">
                {p.body}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--brand-ink)]/50">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {p.published_at ? new Date(p.published_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }) : "—"}
              </span>
              {p.attachment_url && (
                <a
                  href={p.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium"
                  style={{ color: "var(--brand-emerald)" }}
                >
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function BrochuresList() {
  const { data, isLoading, error } = useContentBrochures();
  if (isLoading) return <LoadingSkeletons />;
  if (error) return <ErrorState />;
  if (!data || data.length === 0) return <EmptyState icon={BookOpen} label="No brochures yet" />;
  return (
    <div className="flex flex-col gap-3">
      {data.map((b) => (
        <div key={b.id} className="agent-card flex items-center gap-3 p-3">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: "color-mix(in srgb, var(--brand-gold) 18%, white)", color: "#8a6d24" }}
          >
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-semibold">{b.title}</div>
            {b.description && (
              <div className="mt-0.5 line-clamp-1 text-xs text-[var(--brand-ink)]/60">
                {b.description}
              </div>
            )}
            <div className="mt-1 text-[11px] text-[var(--brand-ink)]/45">
              {b.published_at
                ? new Date(b.published_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })
                : "—"}
              {b.file_size_bytes ? ` · ${formatBytes(b.file_size_bytes)}` : ""}
            </div>
          </div>
          {b.file_url && (
            <a
              href={b.file_url}
              target="_blank"
              rel="noreferrer"
              className="agent-press flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--brand-emerald)", color: "#fff" }}
              aria-label={`Download ${b.title}`}
            >
              <Download className="h-4 w-4" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function VideosList() {
  const { data, isLoading, error } = useContentVideos();
  if (isLoading) return <LoadingSkeletons />;
  if (error) return <ErrorState />;
  if (!data || data.length === 0) return <EmptyState icon={PlayCircle} label="No videos yet" />;
  return (
    <div className="flex flex-col gap-3">
      {data.map((v) => (
        <a
          key={v.id}
          href={v.video_url || "#"}
          target="_blank"
          rel="noreferrer"
          className="agent-card overflow-hidden block"
        >
          <div className="relative aspect-[16/9] w-full bg-[var(--brand-emerald-tint)]">
            {v.thumbnail_url ? (
              <img src={v.thumbnail_url} alt={v.title} className="h-full w-full object-cover" loading="lazy" />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.9)", color: "var(--brand-emerald)" }}
              >
                <PlayCircle className="h-7 w-7" />
              </div>
            </div>
            {v.duration_seconds != null && (
              <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-white tabular-nums">
                {formatDuration(v.duration_seconds)}
              </div>
            )}
          </div>
          <div className="p-3">
            <div className="text-sm font-semibold leading-tight">{v.title}</div>
            {v.description && (
              <div className="mt-1 line-clamp-2 text-xs text-[var(--brand-ink)]/60 leading-relaxed">
                {v.description}
              </div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}

function LoadingSkeletons() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="agent-card overflow-hidden">
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm"
      style={{ background: "color-mix(in srgb, var(--brand-checkout) 10%, white)", color: "var(--brand-checkout)" }}
    >
      Could not load content. Please try again.
    </div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return (
    <div className="agent-card p-10 text-center">
      <Icon className="mx-auto h-9 w-9 text-[var(--brand-ink)]/25" />
      <div className="mt-2 text-sm font-medium">{label}</div>
      <div className="mt-1 text-xs text-[var(--brand-ink)]/55">
        Check back later for new content.
      </div>
    </div>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

"use client";

// Shared UI primitives for the agent app — loading skeletons, empty /
// error states, and a status pill for attendance statuses.

import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={cn("w-full rounded-2xl", className)} />;
}

export function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3 w-24", className)} />;
}

export function SkeletonList({
  count = 5,
  height = 64,
}: {
  count?: number;
  height?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="w-full rounded-xl" style={{ height }} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-6 py-10 text-center">
      <Icon className="mx-auto h-9 w-9 text-muted-foreground/40" />
      <div className="mt-3 text-sm font-semibold">{title}</div>
      {description && (
        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</div>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-5 text-center">
      <div className="text-sm font-medium">{title}</div>
      {description && (
        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</div>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition active:scale-95"
        >
          Try again
        </button>
      )}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  present: { label: "Present", bg: "color-mix(in srgb, var(--brand-emerald) 12%, white)", fg: "var(--brand-emerald)" },
  late: { label: "Late", bg: "color-mix(in srgb, var(--brand-warn) 15%, white)", fg: "#a16207" },
  half_day: { label: "Half day", bg: "color-mix(in srgb, var(--brand-warn) 15%, white)", fg: "#a16207" },
  absent: { label: "Absent", bg: "color-mix(in srgb, var(--brand-checkout) 10%, white)", fg: "var(--brand-checkout)" },
  on_leave: { label: "Leave", bg: "color-mix(in srgb, var(--brand-gold) 15%, white)", fg: "#8a6d24" },
  cancelled: { label: "Cancelled", bg: "rgba(0,0,0,0.05)", fg: "rgba(0,0,0,0.45)" },
};

export function StatusPill({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const key = (status ?? "").toLowerCase().replace("-", "_");
  const meta = STATUS_META[key] ?? STATUS_META.present;
  if (className) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium",
          className,
        )}
      >
        {meta.label}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium"
      style={{ background: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}

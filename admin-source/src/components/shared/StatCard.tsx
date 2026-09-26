
"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number; // % change
  trendLabel?: string;
  accent?: "emerald" | "sky" | "rose" | "amber" | "slate" | "primary" | "accent";
  hint?: string;
}

const accentClasses: Record<NonNullable<StatCardProps["accent"]>, string> = {
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent-foreground",
};

// Animated counter hook
function useCountUp(target: number, duration: number = 800) {
  const [count, setCount] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || target === 0) return;
    startedRef.current = true;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent = "primary",
  hint,
}: StatCardProps) {
  // Parse numeric value for count-up animation
  const numericValue = typeof value === "string" ? parseInt(value.replace(/[^\d]/g, ""), 10) : value;
  const isNumeric = !isNaN(numericValue) && numericValue > 0 && typeof value !== "string";
  const animatedCount = useCountUp(isNumeric ? numericValue : 0);

  const displayValue = isNumeric ? animatedCount.toLocaleString("en-IN") : value;

  return (
    <Card className="metric-card card-premium p-4 relative overflow-hidden border-border/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </div>
          <div className="text-2xl font-bold tracking-tight mt-1.5 tabular-nums">{displayValue}</div>
          {(hint || trend !== undefined) && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              {trend !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-semibold",
                    trend >= 0 ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(trend)}%
                </span>
              )}
              {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
              {hint && !trendLabel && <span className="text-muted-foreground">{hint}</span>}
            </div>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-xl grid place-items-center shrink-0 transition-transform hover:scale-110", accentClasses[accent])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}



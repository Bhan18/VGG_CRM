"use client";

// Live clock — restored from the existing CRM-VGG Topbar.
// Ticks every second, formatted with the en-IN locale.

import { memo, useEffect, useState } from "react";

function LiveClockComponent({ className }: { className?: string }) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Tick every second. We intentionally avoid setting state synchronously
    // in the effect body — the first render already shows a non-breaking
    // space, and the first tick arrives within 1s.
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    // Fire one tick immediately, but asynchronously.
    const t0 = setTimeout(() => setCurrentTime(new Date()), 0);
    return () => {
      clearInterval(timer);
      clearTimeout(t0);
    };
  }, []);

  if (!currentTime) {
    return <span className={className}>&nbsp;</span>;
  }

  const date = currentTime.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = currentTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <span className={className} suppressHydrationWarning>
      <span className="opacity-80">{date}</span>
      <span className="mx-2 opacity-30">·</span>
      <span className="tabular-nums">{time}</span>
    </span>
  );
}

export const LiveClock = memo(LiveClockComponent);

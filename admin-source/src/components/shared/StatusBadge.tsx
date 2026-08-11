
"use client";

import { Badge } from "@/components/ui/badge";
import { statusColor } from "@/lib/format";
import type { PlotStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: PlotStatus }) {
  const c = statusColor[status];
  return (
    <Badge
      variant="outline"
      className={`${c.bg} ${c.text} border-transparent gap-1 font-medium`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </Badge>
  );
}



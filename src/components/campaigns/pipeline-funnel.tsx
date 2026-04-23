"use client";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PipelineFunnelProps {
  statusCounts: Record<string, number>;
  total: number;
}

/* ------------------------------------------------------------------ */
/*  Stage config                                                       */
/* ------------------------------------------------------------------ */

const STAGES: { key: string; label: string; color: string }[] = [
  { key: "shortlisted", label: "Shortlisted", color: "bg-muted-foreground/40" },
  { key: "outreach_sent", label: "Outreach", color: "bg-info" },
  { key: "negotiating", label: "Negotiating", color: "bg-warning" },
  { key: "confirmed", label: "Confirmed", color: "bg-success" },
  { key: "content_live", label: "Live", color: "bg-primary" },
  { key: "completed", label: "Completed", color: "bg-success/70" },
  { key: "declined", label: "Declined", color: "bg-destructive/60" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PipelineFunnel({ statusCounts, total }: PipelineFunnelProps) {
  if (total === 0) return null;

  const activeStages = STAGES.filter((s) => (statusCounts[s.key] ?? 0) > 0);

  return (
    <div className="space-y-2">
      {/* Segmented bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {activeStages.map((stage) => {
          const count = statusCounts[stage.key] ?? 0;
          const pct = (count / total) * 100;
          return (
            <div
              key={stage.key}
              className={cn("h-full transition-all duration-300", stage.color)}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {activeStages.map((stage) => {
          const count = statusCounts[stage.key] ?? 0;
          return (
            <div key={stage.key} className="flex items-center gap-1.5 text-xs">
              <span
                className={cn("size-2 rounded-full", stage.color)}
              />
              <span className="text-muted-foreground">{stage.label}</span>
              <span className="font-medium text-foreground">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

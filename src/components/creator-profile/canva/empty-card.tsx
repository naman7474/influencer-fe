import * as React from "react";

import { cn } from "@/lib/utils";

interface EmptyCardProps {
  title: string;
  description?: string;
  badge?: string;
  className?: string;
}

export function EmptyCard({ title, description, badge, className }: EmptyCardProps) {
  return (
    <div
      className={cn(
        "flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-[var(--gradient-canva-soft)] p-6 text-center",
        className,
      )}
    >
      {badge ? (
        <span className="rounded-full bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-canva-purple">
          {badge}
        </span>
      ) : null}
      <div className="font-heading text-sm font-bold text-foreground">{title}</div>
      {description ? (
        <div className="max-w-sm text-xs text-muted-foreground">{description}</div>
      ) : null}
    </div>
  );
}

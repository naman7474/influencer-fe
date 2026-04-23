"use client";

import { cn } from "@/lib/utils";

interface ObAgentTagProps {
  label?: string;
  className?: string;
}

export function ObAgentTag({
  label = "auto-filled",
  className,
}: ObAgentTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "bg-[var(--ob-clay-soft)] text-[var(--ob-clay2)]",
        "text-[10px] font-mono font-semibold uppercase tracking-wider",
        className
      )}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-[var(--ob-clay)]" />
      {label}
    </span>
  );
}

"use client";

import { cn } from "@/lib/utils";

interface ObRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function ObRow({ label, hint, children, className }: ObRowProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ob-ink2)]">
          {label}
        </span>
        {hint && (
          <span className="text-[11px] text-[var(--ob-ink3)] leading-tight">
            &mdash; {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

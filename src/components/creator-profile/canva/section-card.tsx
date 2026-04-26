import * as React from "react";

import { cn } from "@/lib/utils";

interface SectionCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  span?: 1 | 2;
}

export function SectionCard({
  title,
  subtitle,
  right,
  span = 1,
  className,
  children,
  ...rest
}: SectionCardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-2xl border border-border bg-card p-[18px]",
        span === 2 && "lg:col-span-2",
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-heading text-sm font-extrabold leading-tight text-foreground">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

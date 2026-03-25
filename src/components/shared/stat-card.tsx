import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  subtext,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  subtext?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border bg-card", className)}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
          </div>
          {icon && (
            <div className="rounded-md border bg-muted/50 p-2 text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
        {subtext && (
          <p className="mt-2 text-xs text-muted-foreground">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}

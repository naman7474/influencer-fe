"use client";

import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AnalysisStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function AnalysisStatusBadge({
  status,
  className,
}: AnalysisStatusBadgeProps) {
  if (!status || status === "pending") return null;

  if (status === "processing" || status === "transcribing" || status === "analyzing") {
    return (
      <Badge variant="secondary" className={cn("text-[9px] gap-1", className)}>
        <Loader2 className="size-2.5 animate-spin" />
        Analyzing...
      </Badge>
    );
  }

  if (status === "completed") {
    return (
      <Badge
        variant="secondary"
        className={cn("text-[9px] gap-1 bg-primary/10 text-primary", className)}
      >
        <Sparkles className="size-2.5" />
        Analysis Ready
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "text-[9px] gap-1 bg-destructive/10 text-destructive",
          className
        )}
      >
        <AlertTriangle className="size-2.5" />
        Analysis Failed
      </Badge>
    );
  }

  return null;
}

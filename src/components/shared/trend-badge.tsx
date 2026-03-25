import { TREND_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TrendBadge({ trend }: { trend: string }) {
  const config = TREND_CONFIG[trend] ?? TREND_CONFIG.insufficient_data;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium ring-1 ring-border",
        config.color
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

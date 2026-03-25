import { TIER_COLORS, TIER_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        TIER_COLORS[tier] ?? "bg-slate-100 text-slate-600"
      )}
    >
      {TIER_LABELS[tier] ?? tier}
    </span>
  );
}

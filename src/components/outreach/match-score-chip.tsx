import { cn } from "@/lib/utils";

/**
 * Small chip that visualises a 0–100 brand-match score. Color buckets:
 *   80+  → strong (success)
 *   60–79 → solid (info)
 *   40–59 → moderate (warning)
 *   <40   → weak (muted)
 */
export function MatchScoreChip({
  score,
  size = "sm",
}: {
  score: number | null | undefined;
  size?: "xs" | "sm";
}) {
  if (score == null) return null;
  const rounded = Math.round(score);

  const tone =
    rounded >= 80
      ? "bg-success/15 text-success"
      : rounded >= 60
      ? "bg-info/15 text-info"
      : rounded >= 40
      ? "bg-warning/15 text-warning"
      : "bg-muted text-muted-foreground";

  const sizing =
    size === "xs"
      ? "text-[9px] px-1.5 py-0.5"
      : "text-[10px] px-2 py-0.5";

  return (
    <span
      title={`Brand match score: ${rounded}/100`}
      className={cn(
        "inline-flex items-center font-semibold rounded-md tabular-nums",
        tone,
        sizing
      )}
    >
      {rounded}
    </span>
  );
}

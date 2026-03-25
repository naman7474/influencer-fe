import { getCPIColor } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CPIBadge({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
}) {
  const color = getCPIColor(score);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 min-w-[32px]",
    md: "text-sm px-2 py-1 min-w-[40px]",
    lg: "text-lg px-3 py-1.5 min-w-[48px] font-semibold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold ring-1 ring-inset shadow-sm",
        color.bg,
        color.text,
        color.ring,
        sizeClasses[size]
      )}
    >
      {score}
    </span>
  );
}

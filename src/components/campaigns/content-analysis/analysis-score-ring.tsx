"use client";

import { cn } from "@/lib/utils";

interface AnalysisScoreRingProps {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

function strokeColor(score: number): string {
  if (score >= 75) return "stroke-success";
  if (score >= 50) return "stroke-warning";
  return "stroke-destructive";
}

const sizes = {
  sm: { size: 24, stroke: 2.5, fontSize: "text-[7px]" },
  md: { size: 36, stroke: 3, fontSize: "text-[9px]" },
  lg: { size: 48, stroke: 3.5, fontSize: "text-xs" },
};

export function AnalysisScoreRing({
  score,
  size = "sm",
  className,
}: AnalysisScoreRingProps) {
  if (score === null || score === undefined) return null;

  const s = sizes[size];
  const radius = (s.size - s.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: s.size, height: s.size }}
    >
      <svg width={s.size} height={s.size} className="-rotate-90">
        <circle
          cx={s.size / 2}
          cy={s.size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={s.stroke}
          className="text-muted/30"
        />
        <circle
          cx={s.size / 2}
          cy={s.size / 2}
          r={radius}
          fill="none"
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={strokeColor(score)}
        />
      </svg>
      <span
        className={cn(
          "absolute font-mono font-semibold",
          s.fontSize,
          scoreColor(score)
        )}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

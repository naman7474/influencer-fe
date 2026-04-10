"use client";

interface MatchBarProps {
  score: number; // 0-100
}

/**
 * Horizontal progress bar for match scores.
 * Gradient fill from primary (indigo) to success (green).
 */
export function MatchBar({ score }: MatchBarProps) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="cpi-gradient absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Match score ${clamped}%`}
        />
      </div>
      <span className="shrink-0 text-xs font-semibold text-foreground">
        {clamped}%
      </span>
    </div>
  );
}

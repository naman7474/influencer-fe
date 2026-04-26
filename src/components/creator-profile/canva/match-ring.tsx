import * as React from "react";

interface MatchRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
}

export function MatchRing({
  score,
  size = 64,
  strokeWidth = 5,
  className,
  ariaLabel,
}: MatchRingProps) {
  // useId guarantees the same gradient id on server and client renders.
  const reactId = React.useId();
  const gradId = `canva-match-ring-${reactId.replace(/:/g, "")}`;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const fontSize = size > 80 ? 22 : size > 56 ? 18 : 14;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
      role="img"
      aria-label={ariaLabel ?? `Match score ${clamped} out of 100`}
    >
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--canva-purple)" />
            <stop offset="100%" stopColor="var(--canva-teal)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize,
          color: "var(--foreground)",
          letterSpacing: "-0.02em",
        }}
      >
        {clamped}
      </div>
    </div>
  );
}

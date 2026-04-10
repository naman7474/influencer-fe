"use client";

import React from "react";

interface CpiRingProps {
  score: number; // 0-100
  size?: number; // diameter in px, default 40
  strokeWidth?: number; // default 4
}

/**
 * Circular SVG progress ring for CPI (Creator Performance Index) scores.
 * Uses a gradient from primary (indigo) to success (green).
 */
export function CpiRing({
  score,
  size = 40,
  strokeWidth = 4,
}: CpiRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  const gradientId = `cpi-gradient-${React.useId().replace(/:/g, "")}`;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`CPI score ${clamped}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--success)" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />

        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>

      {/* Centered label */}
      <span
        className="absolute text-[16px] font-bold leading-none text-foreground"
        aria-hidden="true"
      >
        {clamped}
      </span>
    </div>
  );
}

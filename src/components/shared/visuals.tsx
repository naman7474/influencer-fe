import { CSSProperties } from "react";
import { clamp, normalizePercentValue } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ScoreRing({
  value,
  label,
  sublabel,
  size = "md",
  tone = "var(--color-primary)",
}: {
  value?: number | null;
  label: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  tone?: string;
}) {
  const percentage = normalizePercentValue(value);
  const dimensions = {
    sm: "h-18 w-18 text-xl",
    md: "h-24 w-24 text-3xl",
    lg: "h-32 w-32 text-4xl",
  };

  return (
    <div className="inline-flex flex-col items-center gap-2 text-center">
      <div
        className={cn(
          "relative inline-grid place-items-center rounded-full",
          dimensions[size]
        )}
        style={
          {
            background: `conic-gradient(${tone} ${percentage}%, rgba(15, 23, 42, 0.12) ${percentage}% 100%)`,
          } as CSSProperties
        }
      >
        <div className="absolute inset-[10%] rounded-full bg-background" />
        <span className="relative font-semibold tracking-tight text-foreground">
          {Math.round(percentage)}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          {label}
        </p>
        {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}

export function Meter({
  label,
  value,
  helper,
  indicatorClassName,
}: {
  label: string;
  value?: number | null;
  helper?: string;
  indicatorClassName?: string;
}) {
  const percentage = normalizePercentValue(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-foreground">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200/80">
        <div
          className={cn(
            "h-full rounded-full bg-[linear-gradient(90deg,#f97316,#fb923c)]",
            indicatorClassName
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

export function SegmentedBar({
  segments,
  className,
}: {
  segments: Array<{
    label: string;
    value?: number | null;
    color?: string;
  }>;
  className?: string;
}) {
  const normalized = segments
    .map((segment, index) => ({
      ...segment,
      safeValue:
        segment.value == null || Number.isNaN(segment.value)
          ? 0
          : Math.abs(segment.value) > 1
            ? segment.value
            : segment.value * 100,
      color:
        segment.color ??
        ["#f97316", "#fb923c", "#fdba74", "#0f766e", "#155e75"][index % 5],
    }))
    .filter((segment) => segment.safeValue > 0);

  const total = normalized.reduce((sum, segment) => sum + segment.safeValue, 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-200/80">
        {normalized.map((segment) => (
          <div
            key={segment.label}
            className="h-full"
            style={{
              width: `${total === 0 ? 0 : (segment.safeValue / total) * 100}%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {normalized.map((segment) => (
          <div
            key={segment.label}
            className="inline-flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span>
              {segment.label} {Math.round((segment.safeValue / (total || 1)) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({
  values,
  className,
  color = "#f97316",
}: {
  values: number[];
  className?: string;
  color?: string;
}) {
  const safeValues = values.length > 0 ? values : [0, 0];
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const width = 180;
  const height = 60;
  const span = max - min || 1;

  const points = safeValues.map((value, index) => {
    const x =
      safeValues.length === 1
        ? width / 2
        : (index / (safeValues.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 6) - 3;
    return `${x},${clamp(y, 0, height)}`;
  });

  const polyline = points.join(" ");
  const area = `0,${height} ${polyline} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-16 w-full", className)}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={area}
        fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, "")})`}
      />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

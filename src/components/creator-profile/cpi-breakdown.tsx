"use client";

import { Zap, Palette, Users, TrendingUp, BadgeCheck } from "lucide-react";
import type { CreatorScore } from "@/lib/types/database";
import { CpiRing } from "@/components/creators/cpi-ring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CpiBreakdownProps {
  scores: CreatorScore | null;
}

interface Pillar {
  key: keyof CreatorScore;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const PILLARS: Pillar[] = [
  {
    key: "engagement_quality",
    label: "Engagement",
    icon: <Zap className="size-3.5" />,
    description: "Depth of likes, comments, and replies",
  },
  {
    key: "content_quality",
    label: "Content",
    icon: <Palette className="size-3.5" />,
    description: "Craft, hook, production consistency",
  },
  {
    key: "audience_authenticity",
    label: "Authenticity",
    icon: <Users className="size-3.5" />,
    description: "Real followers, substantive comments",
  },
  {
    key: "growth_trajectory",
    label: "Growth",
    icon: <TrendingUp className="size-3.5" />,
    description: "Follower and engagement trajectory",
  },
  {
    key: "professionalism",
    label: "Professionalism",
    icon: <BadgeCheck className="size-3.5" />,
    description: "Response reliability, posting consistency",
  },
];

function toPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.round(v > 1 ? v : v * 100);
}

export function CpiBreakdown({ scores }: CpiBreakdownProps) {
  if (!scores) return null;

  const cpi = toPct(scores.cpi) ?? 0;

  const pillarValues = PILLARS.map((p) => ({
    ...p,
    value: toPct(scores[p.key] as number | null | undefined),
  }));

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>CPI Composition</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          {/* Central ring */}
          <div className="flex shrink-0 flex-col items-center gap-2 md:w-40">
            <CpiRing score={cpi} size={104} strokeWidth={8} />
            <p className="text-center text-[11px] text-muted-foreground">
              Creator Performance Index
            </p>
          </div>

          {/* 5 sub-pillar bars */}
          <div className="flex-1 space-y-2.5">
            {pillarValues.map((p) => (
              <PillarRow key={p.key as string} pillar={p} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PillarRow({
  pillar,
}: {
  pillar: Pillar & { value: number | null };
}) {
  const { label, icon, description, value } = pillar;
  const pct = value ?? 0;
  const color =
    pct >= 70
      ? "bg-success"
      : pct >= 40
        ? "bg-warning"
        : "bg-destructive";
  const valueColor =
    pct >= 70
      ? "text-success"
      : pct >= 40
        ? "text-warning"
        : "text-destructive";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="flex-1 truncate text-[11px] text-muted-foreground">
          {description}
        </span>
        <span
          className={cn("w-10 text-right text-sm font-semibold tabular-nums", valueColor)}
        >
          {value != null ? `${pct}` : "--"}
        </span>
      </div>
      <div className="relative ml-7 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-300", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

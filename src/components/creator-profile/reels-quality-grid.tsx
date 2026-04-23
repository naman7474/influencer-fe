"use client";

import { Play, Repeat, Clock, Volume2 } from "lucide-react";
import type {
  CreatorScore,
  TranscriptIntelligence,
} from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReelsQualityGridProps {
  scores: CreatorScore | null;
  transcript: TranscriptIntelligence | null;
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}

function pct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v > 1 ? v : v * 100;
}

export function ReelsQualityGrid({
  scores,
  transcript,
}: ReelsQualityGridProps) {
  const viewsToLikes = scores?.avg_views_to_likes_ratio;
  const rewatch = scores?.avg_rewatch_rate;
  const length = scores?.avg_reel_length_seconds;
  const audio = transcript?.audio_quality_rating;

  const hasAny =
    viewsToLikes != null ||
    rewatch != null ||
    length != null ||
    audio != null;

  if (!hasAny) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="size-4 text-primary" />
          Reel Quality Signals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            icon={<Play className="size-4" />}
            label="Views : Likes"
            value={
              viewsToLikes != null ? `${viewsToLikes.toFixed(1)}x` : null
            }
            hint="Higher means more reach per like"
          />
          <Tile
            icon={<Repeat className="size-4" />}
            label="Rewatch rate"
            value={rewatch != null ? `${pct(rewatch)!.toFixed(0)}%` : null}
            hint="Viewers who rewatch"
            color={rewatch != null ? rewatchColor(pct(rewatch)!) : undefined}
          />
          <Tile
            icon={<Clock className="size-4" />}
            label="Avg length"
            value={length != null ? formatSeconds(length) : null}
            hint="Typical reel duration"
          />
          <Tile
            icon={<Volume2 className="size-4" />}
            label="Audio quality"
            value={audio != null ? `${pct(audio)!.toFixed(0)}%` : null}
            hint="Production clarity"
            color={audio != null ? rewatchColor(pct(audio)!) : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function rewatchColor(p: number): string {
  if (p >= 70) return "text-success";
  if (p >= 40) return "text-warning";
  return "text-destructive";
}

function Tile({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5">
      <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          color ?? "text-foreground",
        )}
      >
        {value ?? "--"}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

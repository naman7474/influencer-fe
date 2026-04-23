"use client";

import { AlertTriangle, MessageCircle } from "lucide-react";
import type {
  AudienceIntelligence,
  CreatorScore,
} from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CommentQualityBarProps {
  audience: AudienceIntelligence | null;
  scores: CreatorScore | null;
}

function toPct(v: number | null | undefined): number {
  if (v == null) return 0;
  return v > 1 ? v : v * 100;
}

export function CommentQualityBar({
  audience,
  scores,
}: CommentQualityBarProps) {
  if (!audience) return null;

  const substantive = toPct(audience.substantive_comment_percentage);
  const generic = toPct(audience.generic_comment_percentage);
  const emoji = toPct(audience.emoji_only_percentage);

  const total = substantive + generic + emoji;
  if (total === 0) return null;

  // Normalise so the bar always sums to 100
  const sub = (substantive / total) * 100;
  const gen = (generic / total) * 100;
  const emo = (emoji / total) * 100;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          Comment Quality
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-foreground/10">
          <div
            className="bg-success transition-all"
            style={{ width: `${sub}%` }}
            title={`Substantive ${substantive.toFixed(0)}%`}
          />
          <div
            className="bg-warning transition-all"
            style={{ width: `${gen}%` }}
            title={`Generic ${generic.toFixed(0)}%`}
          />
          <div
            className="bg-destructive transition-all"
            style={{ width: `${emo}%` }}
            title={`Emoji-only ${emoji.toFixed(0)}%`}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <LegendItem color="bg-success" label="Substantive" value={substantive} />
          <LegendItem color="bg-warning" label="Generic" value={generic} />
          <LegendItem color="bg-destructive" label="Emoji-only" value={emoji} />
        </div>

        {/* Supplementary stats */}
        {(scores?.unique_commenter_count != null ||
          audience.conversation_depth != null ||
          audience.community_strength != null) && (
          <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
            {scores?.unique_commenter_count != null && (
              <Stat
                label="Unique commenters"
                value={scores.unique_commenter_count.toLocaleString()}
              />
            )}
            {audience.conversation_depth != null && (
              <Stat
                label="Depth"
                value={depthLabel(audience.conversation_depth)}
              />
            )}
            {audience.community_strength != null && (
              <Stat
                label="Community"
                value={strengthLabel(audience.community_strength)}
              />
            )}
          </div>
        )}

        {/* Suspicious patterns as warning chips */}
        {audience.suspicious_patterns &&
          audience.suspicious_patterns.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-border pt-3">
              {audience.suspicious_patterns.map((p) => (
                <Badge
                  key={p}
                  variant="destructive"
                  className="gap-1 text-[11px]"
                >
                  <AlertTriangle className="size-3" />
                  {p}
                </Badge>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}

function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium text-foreground">
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function depthLabel(v: number): string {
  const p = v > 1 ? v : v * 100;
  if (p >= 70) return "Deep";
  if (p >= 40) return "Moderate";
  return "Shallow";
}

function strengthLabel(v: number): string {
  const p = v > 1 ? v : v * 100;
  if (p >= 70) return "Strong";
  if (p >= 40) return "Moderate";
  return "Weak";
}

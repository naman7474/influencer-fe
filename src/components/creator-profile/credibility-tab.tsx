"use client";

import { Heart, ShieldCheck } from "lucide-react";
import type {
  Creator,
  CreatorScore,
  CaptionIntelligence,
  TranscriptIntelligence,
  AudienceIntelligence,
} from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { formatPercent } from "@/lib/format";

import { CpiBreakdown } from "./cpi-breakdown";
import { CommentQualityBar } from "./comment-quality-bar";
import { VoiceProfile } from "./voice-profile";
import { GrowthSignals } from "./growth-signals";

interface CredibilityTabProps {
  creator: Creator;
  scores: CreatorScore | null;
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
  audience: AudienceIntelligence | null;
}

export function CredibilityTab({
  creator,
  scores,
  caption,
  transcript,
  audience,
}: CredibilityTabProps) {
  return (
    <div className="space-y-6">
      {/* CPI decomposition first */}
      <CpiBreakdown scores={scores} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CommentQualityBar audience={audience} scores={scores} />
        <SentimentCard audience={audience} />
        <VoiceProfile caption={caption} transcript={transcript} />
        <GrowthSignals creator={creator} scores={scores} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sentiment card (distilled from audience-tab)                        */
/* ------------------------------------------------------------------ */

function SentimentCard({
  audience,
}: {
  audience: AudienceIntelligence | null;
}) {
  if (!audience) return null;

  const hasAny =
    audience.overall_sentiment != null ||
    audience.sentiment_score != null ||
    (audience.positive_themes && audience.positive_themes.length > 0) ||
    (audience.negative_themes && audience.negative_themes.length > 0);

  if (!hasAny) return null;

  const sentiment = audience.overall_sentiment?.toLowerCase();
  const badgeVariant:
    | "default"
    | "secondary"
    | "destructive"
    | "outline" =
    sentiment === "positive"
      ? "default"
      : sentiment === "negative"
        ? "destructive"
        : sentiment === "mixed"
          ? "outline"
          : "secondary";

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-4 text-primary" />
          Audience Sentiment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {audience.overall_sentiment && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Overall</span>
            <Badge variant={badgeVariant} className="capitalize">
              {audience.overall_sentiment}
            </Badge>
          </div>
        )}

        {audience.sentiment_score != null && (
          <Progress value={Math.round(audience.sentiment_score * 100)}>
            <ProgressLabel>Sentiment score</ProgressLabel>
            <ProgressValue>
              {() => formatPercent(audience.sentiment_score!)}
            </ProgressValue>
          </Progress>
        )}

        {audience.positive_themes && audience.positive_themes.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Positive themes
            </p>
            <div className="flex flex-wrap gap-1">
              {audience.positive_themes.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="bg-success/10 text-success"
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {audience.negative_themes && audience.negative_themes.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Negative themes
            </p>
            <div className="flex flex-wrap gap-1">
              {audience.negative_themes.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="bg-destructive/10 text-destructive"
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {audience.engagement_quality_score != null && (
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Engagement quality
            </span>
            <span className="font-medium text-foreground">
              {formatPercent(audience.engagement_quality_score)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

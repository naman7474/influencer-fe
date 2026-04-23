"use client";

import {
  Palette,
  Globe,
  Users,
  MessageCircle,
  Tag,
  Languages,
  MapPin,
  UserCircle,
} from "lucide-react";
import type {
  Creator,
  CaptionIntelligence,
  TranscriptIntelligence,
  AudienceIntelligence,
  CreatorScore,
  CreatorBrandMatch,
  Json,
} from "@/lib/types/database";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/format";
import { MatchEvidence } from "./match-evidence-row";

interface FitTabProps {
  creator: Creator;
  scores: CreatorScore | null;
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
  audience: AudienceIntelligence | null;
  match: CreatorBrandMatch | null;
}

export function FitTab({
  creator,
  scores,
  caption,
  transcript,
  audience,
  match,
}: FitTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column — Who they are */}
        <div className="space-y-4">
          <NicheToneCard caption={caption} />
          <ContentPillarsCard caption={caption} />
        </div>

        {/* Right column — Who watches them */}
        <div className="space-y-4">
          <AudienceGeoCard audience={audience} creator={creator} />
          <AudienceDemoCard audience={audience} transcript={transcript} />
        </div>
      </div>

      {/* Brand match evidence (only when brand viewer) */}
      {match && match.match_score != null && (
        <MatchEvidence
          match={match}
          creator={creator}
          scores={scores}
          caption={caption}
          audience={audience}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Who they are                                                       */
/* ------------------------------------------------------------------ */

function NicheToneCard({ caption }: { caption: CaptionIntelligence | null }) {
  if (!caption?.primary_niche) return <EmptyCard title="Niche & Tone" icon={<Palette className="size-4 text-primary" />} />;

  const confidence = caption.niche_confidence;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-4 text-primary" />
          Niche & Tone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{caption.primary_niche}</Badge>
          {caption.secondary_niche && (
            <Badge variant="outline">{caption.secondary_niche}</Badge>
          )}
          {confidence != null && (
            <span className="text-[11px] text-muted-foreground">
              {formatPercent(confidence)} confidence
            </span>
          )}
        </div>
        {caption.primary_tone && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Tone:</span>
            <Badge variant="secondary" className="capitalize">
              {caption.primary_tone}
            </Badge>
            {caption.secondary_tone && (
              <Badge variant="outline" className="capitalize">
                {caption.secondary_tone}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContentPillarsCard({
  caption,
}: {
  caption: CaptionIntelligence | null;
}) {
  const pillars = caption?.content_pillars ?? [];
  const topics = caption?.recurring_topics ?? [];
  if (pillars.length === 0 && topics.length === 0) {
    return (
      <EmptyCard
        title="Content Pillars"
        icon={<Tag className="size-4 text-primary" />}
      />
    );
  }
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="size-4 text-primary" />
          Content Pillars
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pillars.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pillars.map((p) => (
              <Badge key={p} variant="secondary">
                {p}
              </Badge>
            ))}
          </div>
        )}
        {topics.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recurring topics
            </p>
            <div className="flex flex-wrap gap-1">
              {topics.slice(0, 10).map((t) => (
                <Badge key={t} variant="outline" className="text-[11px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Who watches them                                                   */
/* ------------------------------------------------------------------ */

function AudienceGeoCard({
  audience,
  creator,
}: {
  audience: AudienceIntelligence | null;
  creator: Creator;
}) {
  if (!audience) {
    return (
      <EmptyCard
        title="Where they watch from"
        icon={<Globe className="size-4 text-primary" />}
      />
    );
  }

  const regions = parseGeoRegions(audience.geo_regions);
  const primaryCountry = audience.primary_country ?? creator.country;
  const domesticPct = audience.domestic_percentage;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4 text-primary" />
          Where they watch from
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {primaryCountry && (
          <div className="flex items-baseline justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" />
              Primary
            </span>
            <span className="font-medium text-foreground">
              {primaryCountry}
              {domesticPct != null && (
                <span className="ml-1 text-muted-foreground">
                  ({formatPercent(domesticPct)})
                </span>
              )}
            </span>
          </div>
        )}
        {regions.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            {regions.slice(0, 5).map((r) => (
              <div key={r.region} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{r.region}</span>
                  <span className="text-muted-foreground">
                    {r.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary/70"
                    style={{ width: `${r.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AudienceDemoCard({
  audience,
  transcript,
}: {
  audience: AudienceIntelligence | null;
  transcript: TranscriptIntelligence | null;
}) {
  if (!audience) {
    return (
      <EmptyCard
        title="Who they are"
        icon={<Users className="size-4 text-primary" />}
      />
    );
  }

  const audLangs = parseLanguages(audience.audience_languages);
  const primaryAudLang = audience.primary_audience_language;
  const spoken = transcript?.primary_spoken_language;
  const mismatch = transcript?.caption_vs_spoken_mismatch === true;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="size-4 text-primary" />
          Audience profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(audience.estimated_age_group || audience.estimated_gender_skew) && (
          <div className="flex flex-wrap gap-2">
            {audience.estimated_age_group && (
              <Badge variant="outline">
                Age {audience.estimated_age_group}
              </Badge>
            )}
            {audience.estimated_gender_skew && (
              <Badge variant="outline">
                {audience.estimated_gender_skew}
              </Badge>
            )}
            {audience.is_multilingual_audience && (
              <Badge variant="secondary">Multilingual</Badge>
            )}
          </div>
        )}

        {(primaryAudLang || audLangs.length > 0) && (
          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Languages className="size-3" />
              Audience language
            </p>
            <div className="flex flex-wrap gap-1.5">
              {primaryAudLang && (
                <Badge variant="secondary">{primaryAudLang}</Badge>
              )}
              {audLangs
                .filter((l) => l.name !== primaryAudLang)
                .slice(0, 4)
                .map((l) => (
                  <Badge
                    key={l.name}
                    variant="outline"
                    className="text-[11px]"
                  >
                    {l.name} {l.percentage.toFixed(0)}%
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {spoken && (
          <div className="flex items-center justify-between text-xs border-t border-border pt-3">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <MessageCircle className="size-3" />
              Creator speaks
            </span>
            <span className="font-medium text-foreground">{spoken}</span>
          </div>
        )}

        {mismatch && (
          <p className="rounded bg-warning/10 p-2 text-[11px] text-warning">
            Caption language differs from spoken — worth confirming audience
            fit.
          </p>
        )}

        {audience.interest_signals && audience.interest_signals.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Interest signals
            </p>
            <div className="flex flex-wrap gap-1">
              {audience.interest_signals.slice(0, 8).map((i) => (
                <Badge key={i} variant="outline" className="text-[11px]">
                  {i}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function EmptyCard({
  title,
  icon,
}: {
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="py-4 text-center text-xs text-muted-foreground">
          No data available
        </p>
      </CardContent>
    </Card>
  );
}

function parseGeoRegions(
  data: Json | null,
): Array<{ region: string; percentage: number }> {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data
      .map((r) => {
        const obj = r as Record<string, Json>;
        const raw = Number(obj.confidence ?? obj.percentage ?? obj.pct ?? 0);
        return {
          region: String(obj.region ?? obj.country ?? "Unknown"),
          percentage: raw > 1 ? raw : raw * 100,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);
  }
  if (typeof data === "object") {
    return Object.entries(data as Record<string, number>)
      .map(([region, val]) => ({
        region,
        percentage: Number(val) > 1 ? Number(val) : Number(val) * 100,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }
  return [];
}

function parseLanguages(
  data: Json | null,
): Array<{ name: string; percentage: number }> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data as Record<string, number>)
    .map(([name, val]) => ({
      name,
      percentage: Number(val) > 1 ? Number(val) : Number(val) * 100,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

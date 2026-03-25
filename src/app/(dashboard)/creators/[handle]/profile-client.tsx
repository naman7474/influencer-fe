"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  BadgeCheck,
  Download,
  HeartHandshake,
  MapPinned,
  Megaphone,
  MessageCircleMore,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CPIBadge } from "@/components/shared/cpi-badge";
import { NicheChip } from "@/components/shared/niche-chip";
import { StatCard } from "@/components/shared/stat-card";
import { TierBadge } from "@/components/shared/tier-badge";
import { TrendBadge } from "@/components/shared/trend-badge";
import {
  Meter,
  ScoreRing,
  SegmentedBar,
  Sparkline,
} from "@/components/shared/visuals";
import {
  clamp,
  formatDateLabel,
  formatNumber,
  formatPercent,
  humanize,
  normalizePercentValue,
} from "@/lib/constants";

type DistributionSource =
  | Record<string, number>
  | Array<{ label?: string; name?: string; type?: string; value?: number; percentage?: number; score?: number }>;

interface ProfileCreator {
  avatar_url?: string;
  handle?: string;
  is_verified?: boolean;
  tier?: string;
  category?: string;
  display_name?: string;
  city?: string;
  country?: string;
  biography?: string;
  followers?: number;
  posts_count?: number;
  following?: number;
}

interface ProfileScores {
  cpi?: number;
  avg_engagement_rate?: number;
  engagement_trend?: string;
  posts_per_week?: number;
  avg_likes_to_comments_ratio?: number;
  content_mix?: DistributionSource;
  engagement_by_content_type?: DistributionSource;
  peak_posting_hours?: DistributionSource;
  avg_views_to_likes_ratio?: number;
  avg_rewatch_rate?: number;
  avg_reel_length_seconds?: number;
  creator_reply_rate?: number;
  engagement_quality?: number;
  content_quality?: number;
  audience_authenticity?: number;
  growth_trajectory?: number;
  professionalism?: number;
  sponsored_vs_organic_delta?: number;
}

interface CaptionIntel {
  primary_niche?: string;
  secondary_niche?: string;
  primary_tone?: string;
  niche_confidence?: number;
  formality_score?: number;
  humor_score?: number;
  authenticity_feel?: number;
  content_pillars?: string[];
  recurring_topics?: string[];
  language_mix?: DistributionSource;
  primary_language?: string;
  dominant_cta_style?: string;
  cta_frequency?: number;
  is_conversion_oriented?: boolean;
  uses_transliteration?: boolean;
  organic_brand_mentions?: string[];
  paid_brand_mentions?: string[];
}

interface TranscriptIntel {
  primary_spoken_language?: string;
  caption_vs_spoken_mismatch?: boolean;
  avg_hook_quality?: number;
  dominant_hook_style?: string;
  hook_details?: Array<Record<string, unknown>>;
  educational_density?: number;
  storytelling_score?: number;
  audio_quality_rating?: string;
  voiceover_vs_oncamera?: string;
  pacing?: string;
  uses_background_music?: boolean;
}

interface AudienceIntel {
  geo_regions?: DistributionSource;
  audience_languages?: DistributionSource;
  authenticity_score?: number;
  substantive_comment_percentage?: number;
  generic_comment_percentage?: number;
  emoji_only_percentage?: number;
  suspicious_patterns?: string[];
  primary_country?: string;
  primary_audience_language?: string;
  is_multilingual_audience?: boolean;
  positive_themes?: string[];
  negative_themes?: string[];
  overall_sentiment?: string;
  estimated_age_group?: string;
  estimated_gender_skew?: string;
  interest_signals?: string[];
}

interface ProfilePost {
  id: string | number;
  thumbnail_url?: string;
  content_type?: string;
  is_paid_partnership?: boolean;
  date_posted?: string;
  description?: string;
  likes?: number;
  num_comments?: number;
  engagement_rate?: number;
}

interface Props {
  profile: {
    creator: ProfileCreator;
    scores: ProfileScores | null;
    captionIntel: CaptionIntel | null;
    transcriptIntel: TranscriptIntel | null;
    audienceIntel: AudienceIntel | null;
    posts: ProfilePost[];
    brandMatch: {
      match_score?: number;
      niche_fit_score?: number;
      audience_geo_score?: number;
      price_tier_score?: number;
      engagement_score?: number;
      brand_safety_score?: number;
      content_style_score?: number;
      match_reasoning?: string | null;
      geo_match_regions?: Array<{
        region?: string;
        weight?: number;
        problem_type?: string;
        gap_score?: number;
      }>;
    } | null;
  };
  shopifyConnected: boolean;
  shopifySyncStatus: string;
}

type PostFilter = "all" | "video" | "image" | "carousel" | "sponsored";

export function CreatorProfileClient({
  profile,
  shopifyConnected,
  shopifySyncStatus,
}: Props) {
  const { creator, scores, captionIntel, transcriptIntel, audienceIntel, posts } =
    profile;
  const [postFilter, setPostFilter] = useState<PostFilter>("all");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  const engagementSparkline = posts
    .slice()
    .reverse()
    .map((post) => normalizePercentValue(post.engagement_rate));
  const contentMix = toDistribution(
    scores?.content_mix,
    derivePostDistribution(posts, "content_type")
  );
  const engagementByType = toDistribution(
    scores?.engagement_by_content_type,
    deriveAveragePostEngagement(posts)
  );
  const peakPostingHours = toDistribution(scores?.peak_posting_hours);
  const languageMix = toDistribution(
    captionIntel?.language_mix ?? audienceIntel?.audience_languages
  );
  const geoRegions = normalizeRegions(audienceIntel?.geo_regions);
  const contentPillars = toStringList(captionIntel?.content_pillars);
  const recurringTopics = toStringList(captionIntel?.recurring_topics);
  const positiveThemes = toStringList(audienceIntel?.positive_themes);
  const negativeThemes = toStringList(audienceIntel?.negative_themes);
  const suspiciousPatterns = toStringList(audienceIntel?.suspicious_patterns);
  const interestSignals = toStringList(audienceIntel?.interest_signals);
  const organicMentions = toStringList(captionIntel?.organic_brand_mentions);
  const paidMentions = toStringList(captionIntel?.paid_brand_mentions);
  const hookDetails = normalizeHookDetails(transcriptIntel?.hook_details);
  const filteredPosts = posts.filter((post) => matchesPostFilter(post, postFilter));
  const brandFit = profile.brandMatch
    ? mapStoredBrandFit(profile.brandMatch)
    : buildBrandFitPreview({
        creator,
        scores,
        captionIntel,
        transcriptIntel,
        audienceIntel,
      });
  const brandGeoRegions = Array.isArray(profile.brandMatch?.geo_match_regions)
    ? profile.brandMatch.geo_match_regions
        .map((item) => ({
          label: String(item.region ?? "").trim(),
          value: Math.round(Number(item.weight ?? 0) * 100),
          problemType: item.problem_type ?? null,
          gapScore: item.gap_score ?? null,
        }))
        .filter((item) => item.label)
    : [];

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="space-y-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <Avatar className="h-24 w-24 ring-4 ring-white shadow-lg">
                <AvatarImage
                  src={creator.avatar_url ?? undefined}
                  alt={creator.handle}
                />
                <AvatarFallback className="bg-slate-100 text-2xl text-slate-700">
                  {creator.handle?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    @{creator.handle}
                  </h1>
                  {creator.is_verified && (
                    <BadgeCheck className="h-5 w-5 text-sky-500" />
                  )}
                  {creator.tier && <TierBadge tier={creator.tier} />}
                  {creator.category && (
                    <Badge variant="outline">{humanize(creator.category)}</Badge>
                  )}
                </div>
                <p className="mt-2 text-lg text-slate-700">
                  {creator.display_name || "Unnamed creator"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(captionIntel?.primary_niche || creator.category) && (
                    <NicheChip
                      niche={
                        captionIntel?.primary_niche ?? creator.category ?? "unknown"
                      }
                    />
                  )}
                  {captionIntel?.secondary_niche && (
                    <NicheChip niche={captionIntel.secondary_niche} />
                  )}
                  {creator.city || creator.country ? (
                    <Badge variant="secondary">
                      {creator.city ? `${creator.city}, ` : ""}
                      {creator.country ?? "Unknown location"}
                    </Badge>
                  ) : null}
                </div>

                {creator.biography && (
                  <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
                    {creator.biography}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button>
                    <Megaphone className="h-4 w-4" />
                    Add to campaign
                  </Button>
                  <Button variant="outline">
                    <HeartHandshake className="h-4 w-4" />
                    Shortlist
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Followers"
                value={formatNumber(creator.followers)}
                subtext="Current follower count"
              />
              <StatCard
                label="Posts"
                value={formatNumber(creator.posts_count)}
                subtext="Total published content"
              />
              <StatCard
                label="Avg Engagement"
                value={
                  scores?.avg_engagement_rate
                    ? formatPercent(scores.avg_engagement_rate)
                    : "N/A"
                }
                subtext="Across recent posts"
              />
              <StatCard
                label="Momentum"
                value={
                  <span className="inline-flex">
                    <TrendBadge
                      trend={scores?.engagement_trend ?? "insufficient_data"}
                    />
                  </span>
                }
                subtext="Current engagement trajectory"
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-lg border bg-primary text-primary-foreground px-5 py-5">
            <ScoreRing
              value={scores?.cpi ?? 0}
              label="CPI Score"
              sublabel="Creator performance index"
              size="lg"
              tone="#fb923c"
            />
            <div className="w-full rounded-md bg-primary-foreground/10 px-3 py-3 text-sm text-primary-foreground/80">
              <p className="font-semibold text-white">
                {creator.city || creator.country
                  ? `${creator.city ? `${creator.city}, ` : ""}${creator.country ?? ""}`
                  : "Location pending"}
              </p>
              <p className="mt-1">
                {creator.following
                  ? `${formatNumber(creator.following)} following`
                  : "Following count unavailable"}
              </p>
              <div className="mt-3">
                <CPIBadge score={scores?.cpi ?? 0} size="md" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="performance" className="space-y-5">
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto rounded-lg border bg-muted/50 p-1"
        >
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="content">Content Intel</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="brand-fit">Brand Fit</TabsTrigger>
          <TabsTrigger value="posts">Recent Posts</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <InsightCard
              title="Engagement analytics"
              description="Engagement trends and content-type performance."
            >
              <div className="rounded-lg bg-primary text-primary-foreground p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Last 20 posts
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {scores?.avg_engagement_rate
                        ? formatPercent(scores.avg_engagement_rate)
                        : "N/A"}
                    </p>
                  </div>
                  <TrendBadge
                    trend={scores?.engagement_trend ?? "insufficient_data"}
                  />
                </div>
                <Sparkline
                  values={engagementSparkline}
                  className="mt-5"
                  color="#fb923c"
                />
              </div>

              <div className="mt-5 space-y-4">
                {engagementByType.length > 0 ? (
                  engagementByType.map((entry) => (
                    <Meter
                      key={entry.label}
                      label={humanize(entry.label)}
                      value={entry.value}
                      helper="Average engagement rate by content type"
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Content-type engagement data not available yet.
                  </p>
                )}
              </div>
            </InsightCard>

            <InsightCard
              title="Posting behaviour"
              description="Posting frequency, content mix, and peak publishing times."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricTile
                  label="Posts per week"
                  value={scores?.posts_per_week ?? "N/A"}
                />
                <MetricTile
                  label="Likes to comments"
                  value={scores?.avg_likes_to_comments_ratio ?? "N/A"}
                />
              </div>

              <Separator className="my-5" />

              <div>
                <p className="text-sm font-medium text-foreground">
                  Content mix
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Distribution across content formats.
                </p>
                <div className="mt-4">
                  <SegmentedBar segments={contentMix} />
                </div>
              </div>

              <Separator className="my-5" />

              <div>
                <p className="text-sm font-medium text-foreground">
                  Peak posting hours
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {peakPostingHours.length > 0 ? (
                    peakPostingHours.slice(0, 8).map((entry) => (
                      <Badge key={entry.label} variant="secondary">
                        {entry.label}: {Math.round(entry.value)}%
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">No hourly pattern detected yet</Badge>
                  )}
                </div>
              </div>
            </InsightCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <InsightCard
              title="Reel performance"
              description="Video quality and performance metrics."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricTile
                  label="Views to likes"
                  value={scores?.avg_views_to_likes_ratio ?? "N/A"}
                />
                <MetricTile
                  label="Rewatch rate"
                  value={
                    scores?.avg_rewatch_rate
                      ? `${Number(scores.avg_rewatch_rate).toFixed(1)}x`
                      : "N/A"
                  }
                />
                <MetricTile
                  label="Avg reel length"
                  value={
                    scores?.avg_reel_length_seconds
                      ? `${scores.avg_reel_length_seconds}s`
                      : "N/A"
                  }
                />
                <MetricTile
                  label="Creator reply rate"
                  value={
                    scores?.creator_reply_rate
                      ? formatPercent(scores.creator_reply_rate)
                      : "N/A"
                  }
                />
              </div>
            </InsightCard>

            <InsightCard
              title="CPI breakdown"
              description="Performance breakdown across key dimensions."
            >
              <div className="grid gap-4">
                {[
                  { label: "Engagement quality", value: scores?.engagement_quality },
                  { label: "Content quality", value: scores?.content_quality },
                  {
                    label: "Audience authenticity",
                    value:
                      scores?.audience_authenticity ??
                      audienceIntel?.authenticity_score,
                  },
                  { label: "Growth trajectory", value: scores?.growth_trajectory },
                  { label: "Professionalism", value: scores?.professionalism },
                ].map((item) => (
                  <Meter
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    helper="Normalized to a 100-point view for UI readability"
                  />
                ))}
              </div>
            </InsightCard>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <InsightCard
              title="Niche and tone profile"
              description="Content niche, tone, and recurring themes."
            >
              <div className="flex flex-wrap gap-2">
                {captionIntel?.primary_niche && (
                  <NicheChip niche={captionIntel.primary_niche} />
                )}
                {captionIntel?.secondary_niche && (
                  <NicheChip niche={captionIntel.secondary_niche} />
                )}
                {captionIntel?.primary_tone && (
                  <Badge variant="secondary">
                    {humanize(captionIntel.primary_tone)}
                  </Badge>
                )}
              </div>

              {captionIntel?.niche_confidence != null && (
                <div className="mt-5">
                  <Meter
                    label="Niche confidence"
                    value={captionIntel.niche_confidence}
                    helper="Confidence in the dominant niche classification"
                  />
                </div>
              )}

              <Separator className="my-5" />

              <div className="grid gap-4">
                {[
                  { label: "Formality", value: captionIntel?.formality_score },
                  { label: "Humor", value: captionIntel?.humor_score },
                  { label: "Authenticity", value: captionIntel?.authenticity_feel },
                  {
                    label: "Educational density",
                    value: transcriptIntel?.educational_density,
                  },
                  {
                    label: "Storytelling",
                    value: transcriptIntel?.storytelling_score,
                  },
                ].map((item) => (
                  <Meter
                    key={item.label}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </div>

              {(contentPillars.length > 0 || recurringTopics.length > 0) && (
                <>
                  <Separator className="my-5" />
                  <div className="space-y-4">
                    <TagGroup
                      label="Content pillars"
                      items={contentPillars}
                    />
                    <TagGroup
                      label="Recurring topics"
                      items={recurringTopics}
                    />
                  </div>
                </>
              )}
            </InsightCard>

            <InsightCard
              title="Language profile"
              description="Languages used in captions and spoken content."
            >
              <SegmentedBar segments={languageMix} />

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <MetricTile
                  label="Primary caption language"
                  value={captionIntel?.primary_language ?? "N/A"}
                />
                <MetricTile
                  label="Primary spoken language"
                  value={transcriptIntel?.primary_spoken_language ?? "N/A"}
                />
                <MetricTile
                  label="Caption vs spoken"
                  value={
                    transcriptIntel?.caption_vs_spoken_mismatch
                      ? "Mismatch flagged"
                      : "Aligned"
                  }
                />
                <MetricTile
                  label="Transliteration"
                  value={
                    captionIntel?.uses_transliteration ? "Used" : "Not detected"
                  }
                />
              </div>
            </InsightCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <InsightCard
              title="Hook quality and CTA patterns"
              description="Hook quality, CTA style, and conversion potential."
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <ScoreRing
                  value={transcriptIntel?.avg_hook_quality ?? 0}
                  label="Hook score"
                  sublabel={humanize(transcriptIntel?.dominant_hook_style ?? "unknown")}
                  tone="#f97316"
                />

                <div className="grid flex-1 gap-4">
                  <MetricTile
                    label="CTA style"
                    value={humanize(captionIntel?.dominant_cta_style ?? "N/A")}
                  />
                  <MetricTile
                    label="CTA frequency"
                    value={
                      captionIntel?.cta_frequency != null
                        ? formatPercent(captionIntel.cta_frequency)
                        : "N/A"
                    }
                  />
                  <MetricTile
                    label="Conversion orientation"
                    value={
                      captionIntel?.is_conversion_oriented ? "Yes" : "No"
                    }
                  />
                </div>
              </div>

              {hookDetails.length > 0 && (
                <>
                  <Separator className="my-5" />
                  <div className="space-y-3">
                    {hookDetails.slice(0, 5).map((hook) => (
                      <div
                        key={hook.label}
                        className="rounded-lg bg-muted/50 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-foreground">{hook.label}</p>
                          <Badge variant="secondary">{hook.score}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </InsightCard>

            <InsightCard
              title="Audio production"
              description="Audio production, delivery style, and pacing."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricTile
                  label="Audio quality"
                  value={humanize(transcriptIntel?.audio_quality_rating ?? "N/A")}
                />
                <MetricTile
                  label="Voiceover vs on-camera"
                  value={humanize(transcriptIntel?.voiceover_vs_oncamera ?? "N/A")}
                />
                <MetricTile
                  label="Pacing"
                  value={humanize(transcriptIntel?.pacing ?? "N/A")}
                />
                <MetricTile
                  label="Background music"
                  value={
                    transcriptIntel?.uses_background_music ? "Used" : "Not detected"
                  }
                />
              </div>
            </InsightCard>
          </div>
        </TabsContent>

        <TabsContent value="audience" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <InsightCard
              title="Geography heatmap"
              description="Audience geography and language distribution."
            >
              {geoRegions.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {geoRegions.slice(0, 6).map((region) => (
                    <div
                      key={region.label}
                      className="rounded-lg bg-muted/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">
                          {region.label}
                        </p>
                        <Badge variant="secondary">{region.value}%</Badge>
                      </div>
                      <div className="mt-4 h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#f97316,#fb923c)]"
                          style={{ width: `${region.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Geographic data not available yet.
                </p>
              )}

              <div className="mt-5 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
                Inferred from comments, language signals, and activity timing. Invite the creator to connect Insights in v2 for exact geography.
              </div>
            </InsightCard>

            <InsightCard
              title="Authenticity"
              description="Comment quality, engagement authenticity, and trust signals."
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <ScoreRing
                  value={audienceIntel?.authenticity_score ?? 0}
                  label="Authenticity"
                  sublabel="Comment quality and pattern analysis"
                  tone="#0f766e"
                />

                <div className="grid flex-1 gap-4">
                  <Meter
                    label="Substantive comments"
                    value={audienceIntel?.substantive_comment_percentage}
                    indicatorClassName="bg-[linear-gradient(90deg,#0f766e,#22c55e)]"
                  />
                  <Meter
                    label="Generic comments"
                    value={audienceIntel?.generic_comment_percentage}
                    indicatorClassName="bg-[linear-gradient(90deg,#f59e0b,#fb923c)]"
                  />
                  <Meter
                    label="Emoji-only comments"
                    value={audienceIntel?.emoji_only_percentage}
                    indicatorClassName="bg-[linear-gradient(90deg,#e11d48,#fb7185)]"
                  />
                </div>
              </div>

              {suspiciousPatterns.length > 0 && (
                <>
                  <Separator className="my-5" />
                  <TagGroup
                    label="Suspicious patterns"
                    items={suspiciousPatterns}
                    destructive
                  />
                </>
              )}
            </InsightCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <InsightCard
              title="Language and sentiment"
              description="Audience sentiment and recurring conversation themes."
            >
              <SegmentedBar segments={languageMix} />

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <MetricTile
                  label="Primary audience country"
                  value={audienceIntel?.primary_country ?? "N/A"}
                />
                <MetricTile
                  label="Primary audience language"
                  value={audienceIntel?.primary_audience_language ?? "N/A"}
                />
                <MetricTile
                  label="Multilingual audience"
                  value={
                    audienceIntel?.is_multilingual_audience ? "Yes" : "No"
                  }
                />
                <MetricTile
                  label="Overall sentiment"
                  value={humanize(audienceIntel?.overall_sentiment ?? "N/A")}
                />
              </div>

              <Separator className="my-5" />

              <TagGroup label="Positive themes" items={positiveThemes} />
              <div className="mt-4">
                <TagGroup label="Negative themes" items={negativeThemes} destructive />
              </div>
            </InsightCard>

            <InsightCard
              title="Demographics and interests"
              description="Estimated audience demographics and interests."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricTile
                  label="Estimated age group"
                  value={audienceIntel?.estimated_age_group ?? "N/A"}
                />
                <MetricTile
                  label="Estimated gender skew"
                  value={audienceIntel?.estimated_gender_skew ?? "N/A"}
                />
                <MetricTile
                  label="Primary country"
                  value={audienceIntel?.primary_country ?? "N/A"}
                />
                <MetricTile
                  label="Language"
                  value={audienceIntel?.primary_audience_language ?? "N/A"}
                />
              </div>

              <Separator className="my-5" />

              <TagGroup label="Interest signals" items={interestSignals} />
            </InsightCard>
          </div>
        </TabsContent>

        <TabsContent value="brand-fit" className="space-y-6">
          {!shopifyConnected ? (
            <InsightCard
              title="Brand fit unavailable"
              description="Connect Shopify to see brand-creator fit scores."
            >
              <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
                Connect Shopify to generate real audience geo matching, product-category fit, and brand-specific score breakdowns for creators.
              </div>
            </InsightCard>
          ) : shopifySyncStatus === "queued" || shopifySyncStatus === "running" ? (
            <InsightCard
              title="Brand fit syncing"
              description="Brand fit scores are being calculated."
            >
              <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
                Brand fit will appear here after the Shopify sync completes and matching runs in the background.
              </div>
            </InsightCard>
          ) : !profile.brandMatch ? (
            <InsightCard
              title="Brand fit pending"
              description="Brand fit analysis will be available after matching runs."
            >
              <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
                Matching will appear here after Shopify sync and the brand matching pipeline complete.
              </div>
            </InsightCard>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <InsightCard
              title="Brand fit preview"
              description={
                profile.brandMatch
                  ? "Brand-specific match row from creator_brand_matches."
                  : "Creator-side heuristic preview."
              }
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <ScoreRing
                  value={brandFit.overall}
                  label="Match preview"
                  sublabel="Creator-only estimate"
                  tone="#f97316"
                />
                <div className="flex-1 rounded-lg bg-muted/50 px-3 py-3 text-sm text-slate-700">
                  {brandFit.reasoning}
                </div>
              </div>
            </InsightCard>

            <InsightCard
              title="Match score breakdown"
              description={
                profile.brandMatch
                  ? "Stored sub-scores for this brand."
                  : "Proxy component breakdown aligned to the plan."
              }
            >
              <div className="grid gap-4">
                {brandFit.breakdown.map((item) => (
                  <Meter
                    key={item.label}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </div>
            </InsightCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <InsightCard
              title="Brand affinity signals"
              description="Brand mentions and sponsorship activity."
            >
              <TagGroup label="Organic mentions" items={organicMentions} />
              <div className="mt-4">
                <TagGroup label="Paid mentions" items={paidMentions} />
              </div>

              <Separator className="my-5" />

              <div className="grid gap-4 sm:grid-cols-2">
                <SignalTile
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Brand safety"
                  value={`${brandFit.breakdown.find((item) => item.label === "Brand safety")?.value ?? 0}%`}
                />
                <SignalTile
                  icon={<MessageCircleMore className="h-4 w-4" />}
                  label="Sponsored delta"
                  value={
                    scores?.sponsored_vs_organic_delta != null
                      ? formatPercent(scores.sponsored_vs_organic_delta)
                      : "Pending"
                  }
                />
              </div>
            </InsightCard>

            <InsightCard
              title="Geo match and overlap"
              description="Regional fit and audience overlap analysis."
            >
              <div className="space-y-3">
                {brandGeoRegions.length > 0 ? (
                  brandGeoRegions.slice(0, 5).map((region) => (
                    <div
                      key={region.label}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <MapPinned className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium text-foreground">
                            {region.label}
                          </span>
                          {region.problemType ? (
                            <p className="text-xs text-muted-foreground">
                              {humanize(String(region.problemType))}
                              {region.gapScore != null
                                ? ` · gap ${Math.round(Number(region.gapScore) * 100)}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Badge variant="secondary">{region.value}% fit</Badge>
                    </div>
                  ))
                ) : geoRegions.length > 0 ? (
                  geoRegions.slice(0, 5).map((region) => (
                    <div
                      key={region.label}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <MapPinned className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {region.label}
                        </span>
                      </div>
                      <Badge variant="secondary">{region.value}% fit</Badge>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
                    No matched priority regions were stored for this creator yet.
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-lg bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
                Audience overlap against your active campaign roster is not connected yet. Regional fit above comes from the stored brand match row.
              </div>
            </InsightCard>
          </div>
        </TabsContent>

        <TabsContent value="posts" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "All", value: "all" as PostFilter },
              { label: "Video", value: "video" as PostFilter },
              { label: "Image", value: "image" as PostFilter },
              { label: "Carousel", value: "carousel" as PostFilter },
              { label: "Sponsored", value: "sponsored" as PostFilter },
            ].map((filter) => (
              <Button
                key={filter.value}
                variant={postFilter === filter.value ? "default" : "outline"}
                onClick={() => setPostFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {filteredPosts.length === 0 ? (
            <div className="border bg-card px-8 py-16 text-center">
              <p className="text-lg font-semibold text-foreground">
                No posts in this slice
              </p>
              <p className="mt-2 text-slate-600">
                Switch filters to review the creator’s recent feed.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPosts.map((post) => {
                const isExpanded = expandedPostId === String(post.id);
                return (
                  <Card
                    key={post.id}
                    className="border bg-card"
                  >
                    <CardContent className="pt-4">
                      {post.thumbnail_url && (
                        <img
                          src={post.thumbnail_url}
                          alt=""
                          className="h-52 w-full rounded-lg object-cover"
                        />
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {humanize(post.content_type ?? "Unknown")}
                        </Badge>
                        {post.is_paid_partnership && (
                          <Badge variant="outline">Sponsored</Badge>
                        )}
                        {post.date_posted && (
                          <Badge variant="outline">
                            {formatDateLabel(post.date_posted)}
                          </Badge>
                        )}
                      </div>

                      <p
                        className={`mt-4 text-sm text-slate-700 ${
                          isExpanded ? "" : "line-clamp-4"
                        }`}
                      >
                        {post.description || "No caption available."}
                      </p>

                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <MetricTile
                          label="Likes"
                          value={formatNumber(post.likes)}
                          compact
                        />
                        <MetricTile
                          label="Comments"
                          value={formatNumber(post.num_comments)}
                          compact
                        />
                        <MetricTile
                          label="Engagement"
                          value={
                            post.engagement_rate
                              ? formatPercent(post.engagement_rate)
                              : "N/A"
                          }
                          compact
                        />
                      </div>

                      <Button
                        variant="ghost"
                        className="mt-4"
                        onClick={() =>
                          setExpandedPostId(
                            isExpanded ? null : String(post.id)
                          )
                        }
                      >
                        {isExpanded ? "Collapse caption" : "Expand caption"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InsightCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="border bg-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | number;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg bg-muted/50 px-3 ${
        compact ? "py-2" : "py-3"
      }`}
    >
      <p className="text-xs text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SignalTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TagGroup({
  label,
  items,
  destructive = false,
}: {
  label: string;
  items: string[];
  destructive?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <Badge
              key={item}
              variant={destructive ? "destructive" : "secondary"}
            >
              {humanize(item)}
            </Badge>
          ))
        ) : (
          <Badge variant="outline">No signals yet</Badge>
        )}
      </div>
    </div>
  );
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  return [];
}

function toDistribution(
  source: unknown,
  fallback: Array<{ label: string; value: number }> = []
) {
  if (Array.isArray(source)) {
    return source
      .map((entry) => {
        if (typeof entry === "string") {
          return { label: entry, value: 1 };
        }
        if (entry && typeof entry === "object") {
          const label =
            String(
              (entry as Record<string, unknown>).label ??
                (entry as Record<string, unknown>).name ??
                (entry as Record<string, unknown>).type ??
                "Unknown"
            ) || "Unknown";
          const rawValue = Number(
            (entry as Record<string, unknown>).value ??
              (entry as Record<string, unknown>).percentage ??
              (entry as Record<string, unknown>).score ??
              0
          );
          return { label, value: rawValue };
        }
        return null;
      })
      .filter(Boolean) as Array<{ label: string; value: number }>;
  }

  if (source && typeof source === "object") {
    return Object.entries(source as Record<string, unknown>).map(
      ([label, value]) => ({
        label,
        value: Number(value ?? 0),
      })
    );
  }

  return fallback;
}

function normalizeRegions(source: unknown) {
  return toDistribution(source)
    .map((entry) => ({
      label: humanize(entry.label),
      value: Math.round(normalizePercentValue(entry.value)),
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
}

function derivePostDistribution(posts: ProfilePost[], key: keyof ProfilePost) {
  const counts = new Map<string, number>();

  for (const post of posts) {
    const raw = post?.[key];
    if (!raw) continue;
    const label = String(raw).toLowerCase();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([label, value]) => ({
    label,
    value,
  }));
}

function deriveAveragePostEngagement(posts: ProfilePost[]) {
  const buckets = new Map<string, { total: number; count: number }>();

  for (const post of posts) {
    const type = String(post?.content_type ?? "").toLowerCase();
    const engagement = Number(post?.engagement_rate ?? 0);
    if (!type || !engagement) continue;
    const bucket = buckets.get(type) ?? { total: 0, count: 0 };
    bucket.total += engagement;
    bucket.count += 1;
    buckets.set(type, bucket);
  }

  return Array.from(buckets.entries()).map(([label, bucket]) => ({
    label,
    value: bucket.count ? bucket.total / bucket.count : 0,
  }));
}

function normalizeHookDetails(source: unknown) {
  if (!Array.isArray(source)) return [];

  return source
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return {
          label: `Hook ${index + 1}`,
          score: 0,
        };
      }

      const record = entry as Record<string, unknown>;
      return {
        label: String(record.label ?? record.style ?? record.hook ?? `Hook ${index + 1}`),
        score: Math.round(
          normalizePercentValue(
            Number(record.score ?? record.value ?? record.quality ?? 0)
          )
        ),
      };
    })
    .filter((entry) => entry.score >= 0);
}

function matchesPostFilter(post: ProfilePost, filter: PostFilter) {
  const type = String(post?.content_type ?? "").toLowerCase();
  if (filter === "all") return true;
  if (filter === "sponsored") return Boolean(post?.is_paid_partnership);
  return type.includes(filter);
}

function buildBrandFitPreview({
  creator,
  scores,
  captionIntel,
  transcriptIntel,
  audienceIntel,
}: {
  creator: ProfileCreator;
  scores: ProfileScores | null;
  captionIntel: CaptionIntel | null;
  transcriptIntel: TranscriptIntel | null;
  audienceIntel: AudienceIntel | null;
}) {
  const authenticity = normalizePercentValue(audienceIntel?.authenticity_score);
  const nicheFit = normalizePercentValue(captionIntel?.niche_confidence ?? 0.64);
  const rawEngagement = Number(scores?.avg_engagement_rate ?? 0);
  const engagementQuality = clamp(
    rawEngagement > 1 ? rawEngagement * 20 : rawEngagement * 2000,
    0,
    100
  );
  const contentStyle = normalizePercentValue(
    transcriptIntel?.avg_hook_quality ?? captionIntel?.authenticity_feel ?? 0.62
  );
  const brandSafety = clamp(
    92 -
      toStringList(audienceIntel?.suspicious_patterns).length * 12 -
      toStringList(captionIntel?.paid_brand_mentions).length * 3,
    18,
    96
  );
  const topGeoRegion =
    Array.isArray(audienceIntel?.geo_regions) && audienceIntel.geo_regions.length > 0
      ? (audienceIntel.geo_regions[0] as
          | { confidence?: number; percentage?: number }
          | undefined)
      : undefined;
  const geoFit = normalizePercentValue(
    topGeoRegion?.confidence ?? topGeoRegion?.percentage ?? 0.58
  );
  const priceTierMap: Record<string, number> = {
    nano: 88,
    micro: 82,
    mid: 74,
    macro: 60,
    mega: 48,
  };
  const priceTierFit = creator?.tier ? priceTierMap[creator.tier] ?? 68 : 68;

  const breakdown = [
    { label: "Niche fit", value: Math.round(nicheFit) },
    { label: "Audience geo match", value: Math.round(geoFit) },
    { label: "Price tier fit", value: Math.round(priceTierFit) },
    { label: "Engagement quality", value: Math.round(engagementQuality) },
    { label: "Brand safety", value: Math.round(brandSafety) },
    { label: "Content style", value: Math.round(contentStyle) },
    { label: "Audience authenticity", value: Math.round(authenticity) },
  ];

  const overall = Math.round(
    breakdown.reduce((sum, item) => sum + item.value, 0) / breakdown.length
  );

  const reasoning = `${creator?.display_name || creator?.handle || "This creator"} looks strongest for ${humanize(
    captionIntel?.primary_niche ?? creator?.category ?? "general lifestyle"
  )} positioning with a ${humanize(
    captionIntel?.primary_tone ?? "balanced"
  )} tone, ${Math.round(authenticity)}% audience authenticity, and an audience centered around ${
    audienceIntel?.primary_country ?? "their primary market"
  }.`;

  return { overall, breakdown, reasoning };
}

function mapStoredBrandFit(brandMatch: {
  match_score?: number;
  niche_fit_score?: number;
  audience_geo_score?: number;
  price_tier_score?: number;
  engagement_score?: number;
  brand_safety_score?: number;
  content_style_score?: number;
  match_reasoning?: string | null;
}) {
  const breakdown = [
    { label: "Niche fit", value: Math.round(Number(brandMatch.niche_fit_score ?? 0)) },
    {
      label: "Audience geo match",
      value: Math.round(Number(brandMatch.audience_geo_score ?? 0)),
    },
    { label: "Price tier fit", value: Math.round(Number(brandMatch.price_tier_score ?? 0)) },
    {
      label: "Engagement quality",
      value: Math.round(Number(brandMatch.engagement_score ?? 0)),
    },
    { label: "Brand safety", value: Math.round(Number(brandMatch.brand_safety_score ?? 0)) },
    {
      label: "Content style",
      value: Math.round(Number(brandMatch.content_style_score ?? 0)),
    },
  ];

  return {
    overall: Math.round(Number(brandMatch.match_score ?? 0)),
    breakdown,
    reasoning: brandMatch.match_reasoning || "Match reasoning not available yet.",
  };
}

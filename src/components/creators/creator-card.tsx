"use client";

import Link from "next/link";
import { MapPin, Languages, Heart, Eye, UserPlus, BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatFollowers, formatEngagementRate, getTrendIcon } from "@/lib/format";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CpiRing } from "./cpi-ring";
import { MatchBar } from "./match-bar";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CreatorCardCreator {
  creator_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number;
  tier: string;
  is_verified: boolean;
  city: string | null;
  country: string | null;
  cpi: number | null;
  avg_engagement_rate: number | null;
  engagement_trend: string | null;
  primary_niche: string | null;
  primary_tone: string | null;
  primary_spoken_language: string | null;
  audience_authenticity_score: number | null;
}

export interface CreatorCardProps {
  creator: CreatorCardCreator;
  matchScore?: number | null;
  matchReasons?: string | null;
  onAddToCampaign?: (creatorId: string) => void;
  onSaveToList?: (creatorId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(displayName: string | null, handle: string): string {
  if (displayName) {
    return displayName
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return handle.slice(0, 2).toUpperCase();
}

function tierBadgeClass(tier: string): string {
  const t = tier.toLowerCase();
  const map: Record<string, string> = {
    nano: "badge-nano",
    micro: "badge-micro",
    mid: "badge-mid",
    macro: "badge-macro",
    mega: "badge-mega",
  };
  return map[t] ?? "";
}

function authenticityColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CreatorCard({
  creator,
  matchScore,
  matchReasons,
  onAddToCampaign,
  onSaveToList,
}: CreatorCardProps) {
  const {
    creator_id,
    handle,
    display_name,
    avatar_url,
    followers,
    tier,
    is_verified,
    city,
    country,
    cpi,
    avg_engagement_rate,
    engagement_trend,
    primary_niche,
    primary_tone,
    primary_spoken_language,
    audience_authenticity_score,
  } = creator;

  const trend = engagement_trend ? getTrendIcon(engagement_trend) : null;
  const location = [city, country].filter(Boolean).join(", ");
  const reasons = matchReasons
    ? matchReasons.split("|").map((r) => r.trim()).filter(Boolean)
    : [];

  return (
    <Card
      className={cn(
        "group/creator-card border-l-3 border-l-transparent transition-all duration-200",
        "hover:border-l-primary hover:shadow-md"
      )}
    >
      <CardContent className="space-y-3">
        {/* ── Row 1: Avatar + Handle + Verified ── */}
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            {avatar_url && <AvatarImage src={avatar_url} alt={handle} />}
            <AvatarFallback>{getInitials(display_name, handle)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-handle truncate text-foreground">
                @{handle}
              </span>
              {is_verified && (
                <BadgeCheck
                  className="size-4 shrink-0 text-info"
                  aria-label="Verified"
                  data-testid="verified-badge"
                />
              )}
            </div>
            {display_name && (
              <p className="truncate text-sm font-medium text-foreground">
                {display_name}
              </p>
            )}
          </div>
        </div>

        {/* ── Row 2: Followers + Tier ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            Followers:{" "}
            <span className="font-semibold text-foreground">
              {formatFollowers(followers)}
            </span>
          </span>
          <Badge
            variant="secondary"
            className={cn(
              "capitalize",
              tierBadgeClass(tier)
            )}
            data-testid="tier-badge"
          >
            {tier}
          </Badge>
        </div>

        {/* ── Row 3: CPI + Engagement Rate ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {cpi != null && (
            <div className="flex items-center gap-2">
              <CpiRing score={cpi} />
              <span className="text-xs text-muted-foreground">CPI</span>
            </div>
          )}
          {avg_engagement_rate != null && (
            <span className="text-sm text-muted-foreground">
              ER:{" "}
              <span className="font-semibold text-foreground">
                {formatEngagementRate(avg_engagement_rate)}
              </span>
            </span>
          )}
        </div>

        {/* ── Row 4: Niche + Tone ── */}
        {(primary_niche || primary_tone) && (
          <div className="flex flex-wrap items-center gap-2">
            {primary_niche && (
              <Badge variant="secondary" className="font-normal">
                {primary_niche}
              </Badge>
            )}
            {primary_tone && (
              <Badge variant="outline" className="font-normal">
                {primary_tone}
              </Badge>
            )}
          </div>
        )}

        {/* ── Row 5: Location + Language ── */}
        {(location || primary_spoken_language) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {location}
              </span>
            )}
            {primary_spoken_language && (
              <span className="inline-flex items-center gap-1">
                <Languages className="size-3.5" />
                {primary_spoken_language}
              </span>
            )}
          </div>
        )}

        {/* ── Row 6: Authenticity + Trend ── */}
        {(audience_authenticity_score != null || trend) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {audience_authenticity_score != null && (
              <span className="text-muted-foreground">
                Authenticity:{" "}
                <span
                  className={cn(
                    "font-semibold",
                    authenticityColor(audience_authenticity_score)
                  )}
                >
                  {audience_authenticity_score}%
                </span>
              </span>
            )}
            {trend && (
              <span
                className={cn("font-medium", trend.color)}
                data-testid="trend-indicator"
              >
                {trend.icon} {trend.label}
              </span>
            )}
          </div>
        )}

        {/* ── Match Score (conditional) ── */}
        {matchScore != null && (
          <div className="space-y-1.5 pt-1" data-testid="match-section">
            <p className="text-xs font-semibold text-muted-foreground">
              Match:{" "}
              <span className="text-foreground">{matchScore}%</span>
            </p>
            <MatchBar score={matchScore} />
            {reasons.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {reasons.map((reason) => (
                  <Badge
                    key={reason}
                    variant="secondary"
                    className="text-[11px] font-normal"
                  >
                    {reason}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* ── Footer: Actions ── */}
      <CardFooter className="gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/creator/${handle}`} />}
        >
          <Eye className="size-3.5" />
          View
        </Button>

        {onAddToCampaign && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddToCampaign(creator_id)}
          >
            <UserPlus className="size-3.5" />
            Add to Campaign
          </Button>
        )}

        {onSaveToList && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onSaveToList(creator_id)}
            aria-label="Save to list"
          >
            <Heart className="size-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

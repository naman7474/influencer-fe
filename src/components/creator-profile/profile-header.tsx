"use client";

import { useState } from "react";
import {
  MapPin,
  ExternalLink,
  BadgeCheck,
  Copy,
  Check,
  ChevronDown,
  UserPlus,
  Bookmark,
  Mail,
  AlertTriangle,
} from "lucide-react";

import type {
  Creator,
  CreatorScore,
  CreatorBrandMatch,
} from "@/lib/types/database";
import {
  formatFollowers,
  formatPercent,
  formatEngagementRate,
  getTrendIcon,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CpiRing } from "@/components/creators/cpi-ring";
import { MatchBar } from "@/components/creators/match-bar";

/* ------------------------------------------------------------------ */
/*  Tier label + badge class                                           */
/* ------------------------------------------------------------------ */

const TIER_CONFIG: Record<string, { label: string; className: string }> = {
  nano: { label: "Nano", className: "badge-nano" },
  micro: { label: "Micro", className: "badge-micro" },
  mid: { label: "Mid-tier", className: "badge-mid" },
  macro: { label: "Macro", className: "badge-macro" },
  mega: { label: "Mega", className: "badge-mega" },
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ProfileHeaderProps {
  creator: Creator;
  scores: CreatorScore | null;
  match: CreatorBrandMatch | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProfileHeader({ creator, scores, match }: ProfileHeaderProps) {
  const [emailCopied, setEmailCopied] = useState(false);

  const tier = creator.tier ?? "nano";
  const tierCfg = TIER_CONFIG[tier] ?? TIER_CONFIG.nano;

  const location = [creator.city, creator.country].filter(Boolean).join(", ");

  const handleCopyEmail = async () => {
    if (!creator.contact_email) return;
    await navigator.clipboard.writeText(creator.contact_email);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const engTrend = scores?.engagement_trend
    ? getTrendIcon(scores.engagement_trend)
    : null;

  return (
    <div className="space-y-6">
      {/* ── Top row: Avatar + info + actions ── */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="size-[72px] overflow-hidden rounded-full ring-2 ring-border"
          >
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.display_name ?? creator.handle}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted text-lg font-semibold text-muted-foreground">
                {(creator.display_name ?? creator.handle).charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Text info */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Handle + verified + tier */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-handle text-base text-muted-foreground">
              @{creator.handle}
            </span>
            {creator.is_verified && (
              <BadgeCheck className="size-4 text-primary" />
            )}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                tierCfg.className
              )}
            >
              {tierCfg.label}
            </span>
          </div>

          {/* Display name */}
          {creator.display_name && (
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {creator.display_name}
            </h1>
          )}

          {/* Location + Category */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {location}
              </span>
            )}
            {creator.category && (
              <Badge variant="secondary">{creator.category}</Badge>
            )}
          </div>

          {/* Bio */}
          {creator.biography && (
            <p className="line-clamp-2 max-w-2xl text-sm text-muted-foreground">
              {creator.biography}
            </p>
          )}

          {/* External link */}
          {creator.external_url && (
            <a
              href={creator.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              {(() => {
                try {
                  return new URL(creator.external_url!).hostname;
                } catch {
                  return creator.external_url;
                }
              })()}
            </a>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Add to Campaign */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm">
                  <UserPlus className="size-3.5" />
                  Add to Campaign
                  <ChevronDown className="size-3" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <span className="text-muted-foreground">No campaigns yet</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                Create New Campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save to List */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <Bookmark className="size-3.5" />
                  Save to List
                  <ChevronDown className="size-3" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <span className="text-muted-foreground">No lists yet</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                Create New List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Copy Email */}
          {creator.contact_email && (
            <Button variant="outline" size="sm" onClick={handleCopyEmail}>
              {emailCopied ? (
                <>
                  <Check className="size-3.5 text-success" />
                  Copied
                </>
              ) : (
                <>
                  <Mail className="size-3.5" />
                  Copy Email
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ── Stat cards row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {/* Followers */}
        <StatCard
          label="Followers"
          value={creator.followers ? formatFollowers(creator.followers) : "--"}
          sub={tierCfg.label + " tier"}
        />

        {/* CPI */}
        <div className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
          <CpiRing score={scores?.cpi ?? 0} size={48} strokeWidth={5} />
          <div>
            <p className="text-xs text-muted-foreground">CPI Score</p>
            <p className="text-lg font-semibold text-foreground">
              {scores?.cpi ?? "--"}
            </p>
          </div>
        </div>

        {/* Engagement Rate */}
        <StatCard
          label="Engagement Rate"
          value={
            scores?.avg_engagement_rate
              ? formatEngagementRate(scores.avg_engagement_rate)
              : "--"
          }
          sub={
            engTrend ? (
              <span className={cn("inline-flex items-center gap-1", engTrend.color)}>
                {engTrend.icon} {engTrend.label}
              </span>
            ) : undefined
          }
        />

        {/* Authenticity */}
        <StatCard
          label="Authenticity"
          value={
            scores?.audience_authenticity
              ? `${scores.audience_authenticity}%`
              : "--"
          }
          sub="Audience quality"
        />

        {/* Content Quality */}
        <StatCard
          label="Content Quality"
          value={scores?.content_quality ? `${scores.content_quality}` : "--"}
          sub="Score / 100"
          className="hidden lg:flex"
        />
      </div>

      {/* ── Brand match section ── */}
      {match && match.match_score != null && (
        <div className="rounded-xl bg-indigo-soft p-4 ring-1 ring-primary/10">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Brand Match
            </h3>
            <span className="text-sm font-bold text-primary">
              {match.match_score}%
            </span>
          </div>
          <MatchBar score={match.match_score} />
          {match.match_reasoning && (
            <p className="mt-2 text-xs text-muted-foreground">
              {match.match_reasoning}
            </p>
          )}
          {/* Score breakdown chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {match.niche_fit_score != null && (
              <ScoreChip label="Niche Fit" value={match.niche_fit_score} />
            )}
            {match.audience_geo_score != null && (
              <ScoreChip label="Geo Match" value={match.audience_geo_score} />
            )}
            {match.engagement_score != null && (
              <ScoreChip label="Engagement" value={match.engagement_score} />
            )}
            {match.content_style_score != null && (
              <ScoreChip label="Content Style" value={match.content_style_score} />
            )}
            {match.brand_safety_score != null && (
              <BrandSafetyChip value={match.brand_safety_score} />
            )}
            {match.price_tier_score != null && (
              <ScoreChip label="Price Tier" value={match.price_tier_score} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      {sub && (
        <span className="text-xs text-muted-foreground">{sub}</span>
      )}
    </div>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs ring-1 ring-foreground/10">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}%</span>
    </span>
  );
}

function BrandSafetyChip({ value }: { value: number }) {
  // value is 0–1 (stored as 3 decimal places)
  const pct = Math.round(value * 100);
  const isHigh = value >= 0.7;
  const isLow = value < 0.3;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1",
        isHigh
          ? "bg-green-100 text-green-800 ring-green-200 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-800"
          : isLow
            ? "bg-red-100 text-red-800 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800"
            : "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800"
      )}
    >
      {isLow && <AlertTriangle className="h-3 w-3" />}
      <span className="opacity-80">Brand Safety</span>
      <span className="font-semibold">{pct}%</span>
    </span>
  );
}

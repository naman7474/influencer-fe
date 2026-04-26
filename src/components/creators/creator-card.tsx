"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Send, BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatFollowers,
  formatEngagementRate,
} from "@/lib/format";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MatchRing } from "@/components/creator-profile/canva/match-ring";
import { AddToCampaignDialog } from "./add-to-campaign-dialog";

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
  platform?: "instagram" | "youtube";
}

export interface CreatorCardProps {
  creator: CreatorCardCreator;
  matchScore?: number | null;
  matchReasons?: string | null;
  avgViews?: number | null;
  /** Optional override — when omitted, the card opens the campaign-picker dialog. */
  onAddToCampaign?: (creatorId: string) => void;
  onReachOut?: (creatorId: string) => void;
}

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

function PlatformBadge({ platform }: { platform: "instagram" | "youtube" }) {
  if (platform === "youtube") {
    return (
      <span
        aria-label="Platform: youtube"
        data-testid="platform-badge"
        className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-extrabold text-white shadow-sm"
        style={{ background: "var(--yt)" }}
      >
        YT
      </span>
    );
  }
  return (
    <span
      aria-label="Platform: instagram"
      data-testid="platform-badge"
      className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-extrabold text-white shadow-sm"
      style={{ background: "var(--gradient-instagram)" }}
    >
      IG
    </span>
  );
}

function fmtEngagement(rate: number | null): string {
  if (rate == null) return "—";
  return rate <= 1 ? formatEngagementRate(rate) : `${rate.toFixed(1)}%`;
}

function normalizeMatch(score: number | null | undefined): number | null {
  if (score == null) return null;
  return score <= 1 ? Math.round(score * 100) : Math.round(score);
}

export function CreatorCard({
  creator,
  matchScore,
  matchReasons: _matchReasons,
  avgViews = null,
  onAddToCampaign,
  onReachOut,
}: CreatorCardProps) {
  void _matchReasons;
  const {
    creator_id,
    handle,
    display_name,
    avatar_url,
    followers,
    tier,
    is_verified,
    avg_engagement_rate,
    primary_niche,
    primary_tone,
    platform,
  } = creator;

  const niches = [primary_niche, primary_tone].filter((t): t is string => Boolean(t));
  const followersLabel = platform === "youtube" ? "Subscribers" : "Followers";
  const normalizedMatch = normalizeMatch(matchScore);

  const [campaignDialogOpen, setCampaignDialogOpen] = React.useState(false);

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCampaign) {
      onAddToCampaign(creator_id);
      return;
    }
    setCampaignDialogOpen(true);
  };

  const handleReachOutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onReachOut?.(creator_id);
  };

  return (
    <>
      <article
        className={cn(
          "group/creator-card relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow",
          "hover:shadow-[0_8px_24px_rgba(125,42,232,0.12)]",
        )}
      >
        {/* Whole-card link layer — sits behind the action buttons */}
        <Link
          href={`/creator/${handle}`}
          aria-label={`Open ${display_name ?? handle} profile`}
          className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canva-purple"
        />

        <div className="relative z-10 flex h-full flex-col gap-4 p-5 pointer-events-none">
          {/* Top row */}
          <div className="flex items-start gap-3">
            <Avatar className="size-12 shrink-0 ring-2 ring-card shadow-sm">
              {avatar_url && <AvatarImage src={avatar_url} alt={handle} />}
              <AvatarFallback className="bg-canva-purple-soft text-canva-purple">
                {getInitials(display_name, handle)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-heading text-[15px] font-extrabold leading-tight text-foreground">
                  {display_name ?? handle}
                </span>
                {is_verified && (
                  <BadgeCheck
                    data-testid="verified-badge"
                    className="size-4 shrink-0 text-canva-purple"
                    aria-label="Verified"
                  />
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-handle truncate">@{handle}</span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {platform && <PlatformBadge platform={platform} />}
              <span
                data-testid="tier-badge"
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                  tierBadgeClass(tier),
                )}
              >
                {tier}
              </span>
            </div>
          </div>

          {niches.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {niches.map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-canva-purple-soft px-2.5 py-0.5 text-[11px] font-bold capitalize text-canva-purple"
                >
                  {n}
                </span>
              ))}
            </div>
          )}

          {/* 4-metric grid */}
          <div className="grid grid-cols-2 gap-2">
            <Metric label={followersLabel} value={formatFollowers(followers)} />
            <Metric label="Engagement" value={fmtEngagement(avg_engagement_rate)} />
            <Metric
              label="Avg views"
              value={avgViews != null ? formatFollowers(avgViews) : "—"}
            />
            <BrandMatchMetric score={normalizedMatch} />
          </div>

          {/* Actions — re-enable pointer events on the action row */}
          <div className="mt-auto flex items-center gap-2 pt-1 pointer-events-auto">
            <button
              type="button"
              onClick={handleAddClick}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition hover:border-canva-purple/40 hover:bg-canva-purple-soft"
            >
              <Plus className="size-3.5" />
              Add to campaign
            </button>
            <button
              type="button"
              onClick={handleReachOutClick}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-md transition hover:opacity-95"
              style={{ background: "var(--gradient-canva)" }}
            >
              <Send className="size-3.5" />
              Reach out
            </button>
          </div>
        </div>
      </article>

      {!onAddToCampaign && (
        <AddToCampaignDialog
          open={campaignDialogOpen}
          onOpenChange={setCampaignDialogOpen}
          creatorId={creator_id}
          creatorHandle={handle}
          matchScore={matchScore ?? null}
        />
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-heading text-base font-extrabold leading-tight text-foreground">
        {value}
      </div>
    </div>
  );
}

function BrandMatchMetric({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <div className="rounded-xl bg-muted/60 px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Brand match
        </div>
        <div className="font-heading text-base font-extrabold leading-tight text-muted-foreground">
          —
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[var(--gradient-canva-soft)] px-3 py-2">
      <MatchRing score={score} size={36} strokeWidth={3.5} />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Brand match
        </div>
        <div className="font-heading text-base font-extrabold leading-tight text-foreground">
          {score}
          <span className="text-[10px] font-bold text-muted-foreground">/100</span>
        </div>
      </div>
    </div>
  );
}

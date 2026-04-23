"use client";

import Link from "next/link";
import {
  MapPin,
  ExternalLink,
  BadgeCheck,
  ChevronRight,
} from "lucide-react";
import type {
  Creator,
  CreatorScore,
  CreatorBrandMatch,
  CaptionIntelligence,
  TranscriptIntelligence,
  AudienceIntelligence,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { VerdictBanner } from "./verdict-banner";
import { ScoreRibbon } from "./score-ribbon";
import { CautionStrip } from "./caution-strip";

/* ------------------------------------------------------------------ */
/*  Tier config                                                        */
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

interface ProfileHeroProps {
  creator: Creator;
  scores: CreatorScore | null;
  match: CreatorBrandMatch | null;
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
  audience: AudienceIntelligence | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const AVATAR_PALETTE = [
  "#c96a3c",
  "#5bb97b",
  "#5b9bd5",
  "#e2a63d",
  "#c9a0e8",
];

export function ProfileHero({
  creator,
  scores,
  match,
  caption,
  transcript,
  audience,
}: ProfileHeroProps) {
  const tier = creator.tier ?? "nano";
  const tierCfg = TIER_CONFIG[tier] ?? TIER_CONFIG.nano;
  const location = [creator.city, creator.country].filter(Boolean).join(", ");
  const initial = (creator.display_name ?? creator.handle)
    .charAt(0)
    .toUpperCase();
  const avatarColor =
    AVATAR_PALETTE[creator.handle.charCodeAt(0) % AVATAR_PALETTE.length];

  return (
    <div className="space-y-4">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/creators"
          className="transition-colors hover:text-foreground"
        >
          Creators
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-handle text-muted-foreground">
          @{creator.handle}
        </span>
      </div>

      {/* ── Two-column hero ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Left column (identity) — 60% */}
        <div className="flex min-w-0 flex-1 gap-5 overflow-hidden">
          {/* Avatar — large, color-tinted */}
          <div className="shrink-0">
            {creator.avatar_url ? (
              <div
                className="size-24 overflow-hidden rounded-full ring-2"
                style={{ boxShadow: `0 0 0 2px ${avatarColor}44` }}
              >
                <img
                  src={creator.avatar_url}
                  alt={creator.display_name ?? creator.handle}
                  className="size-full object-cover"
                />
              </div>
            ) : (
              <div
                className="flex size-24 items-center justify-center rounded-full text-3xl font-semibold ring-2"
                style={{
                  background: `${avatarColor}22`,
                  color: avatarColor,
                  boxShadow: `0 0 0 2px ${avatarColor}44`,
                }}
              >
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2 overflow-hidden">
            {/* Display name */}
            {creator.display_name && (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {creator.display_name}
              </h1>
            )}

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
                  tierCfg.className,
                )}
              >
                {tierCfg.label}
              </span>
            </div>

            {/* Location + Category + URL */}
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
              {creator.external_url && (
                <a
                  href={creator.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
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

            {/* Bio */}
            {creator.biography && (
              <p
                className="line-clamp-2 text-sm text-muted-foreground"
                style={{
                  wordBreak: "break-all",
                  overflowWrap: "anywhere",
                  whiteSpace: "pre-line",
                }}
              >
                {creator.biography}
              </p>
            )}
          </div>
        </div>

        {/* Right column (verdict) — 40% */}
        <div className="lg:w-[40%] shrink-0">
          <VerdictBanner
            scores={scores}
            match={match}
            tier={tierCfg.label.toLowerCase()}
            category={creator.category}
            engagementTrend={scores?.engagement_trend ?? null}
          />
        </div>
      </div>

      {/* ── Caution strip (conditional) ── */}
      <CautionStrip
        creator={creator}
        scores={scores}
        caption={caption}
        transcript={transcript}
        audience={audience}
      />

      {/* ── Score ribbon ── */}
      <ScoreRibbon
        followers={creator.followers}
        tier={tier}
        scores={scores}
        caption={caption}
        audience={audience}
      />
    </div>
  );
}

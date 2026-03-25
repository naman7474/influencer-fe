import Link from "next/link";
import { BadgeCheck, Bookmark, GitCompareArrows } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CPIBadge } from "@/components/shared/cpi-badge";
import { TierBadge } from "@/components/shared/tier-badge";
import { TrendBadge } from "@/components/shared/trend-badge";
import { NicheChip } from "@/components/shared/niche-chip";
import {
  formatNumber,
  formatPercent,
  humanize,
  normalizePercentValue,
} from "@/lib/constants";

export interface DiscoveryCreator {
  creator_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  cpi: number | null;
  tier: string | null;
  is_verified: boolean;
  primary_niche: string | null;
  primary_tone: string | null;
  followers: number | null;
  avg_engagement_rate: number | null;
  engagement_trend: string;
  audience_country: string | null;
  audience_authenticity_score: number | null;
  match_score?: number | null;
  shortlist_state?: {
    is_shortlisted: boolean;
    shortlist_item_id: string | null;
  };
}

interface CreatorCardProps {
  creator: DiscoveryCreator;
  isShortlisted?: boolean;
  isCompared?: boolean;
  onToggleShortlist?: (creator: DiscoveryCreator) => void;
  onToggleCompare?: (creator: DiscoveryCreator) => void;
}

export function CreatorCard({
  creator,
  isShortlisted = false,
  isCompared = false,
  onToggleShortlist,
  onToggleCompare,
}: CreatorCardProps) {
  const authenticity = normalizePercentValue(
    creator.audience_authenticity_score
  );

  return (
    <Card className="h-full border bg-card transition-colors hover:border-foreground/20">
      <CardContent className="flex h-full flex-col pt-4 pb-4">
        <Link href={`/creators/${creator.handle}`} className="block space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={creator.avatar_url ?? undefined}
                  alt={creator.handle}
                />
                <AvatarFallback className="bg-slate-100 text-slate-700">
                  {creator.handle?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-base font-semibold text-slate-950">
                    @{creator.handle}
                  </span>
                  {creator.is_verified && (
                    <BadgeCheck className="h-4 w-4 text-sky-500" />
                  )}
                </div>
                <p className="truncate text-sm text-slate-600">
                  {creator.display_name || "Unnamed creator"}
                </p>
              </div>
            </div>

            <CPIBadge score={creator.cpi ?? 0} size="md" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {creator.primary_niche && <NicheChip niche={creator.primary_niche} />}
            {creator.tier && <TierBadge tier={creator.tier} />}
            {creator.primary_tone && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                {humanize(creator.primary_tone)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-slate-500">Followers</p>
              <p className="mt-1 font-semibold text-slate-950">
                {formatNumber(creator.followers)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Engagement rate</p>
              <p className="mt-1 font-semibold text-slate-950">
                {creator.avg_engagement_rate
                  ? formatPercent(creator.avg_engagement_rate)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Momentum</p>
              <div className="mt-1">
                <TrendBadge
                  trend={creator.engagement_trend ?? "insufficient_data"}
                />
              </div>
            </div>
            <div>
              <p className="text-slate-500">Authenticity</p>
              <p className="mt-1 font-semibold text-slate-950">
                {Math.round(authenticity)}%
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Audience base
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {creator.audience_country || "Unknown"}
                </p>
              </div>
              <div className="text-right">
                {creator.match_score != null ? (
                  <p className="text-xs text-muted-foreground">
                    Match {Math.round(creator.match_score)}
                  </p>
                ) : null}
                <p className="text-sm font-semibold text-foreground">
                  {Math.round(authenticity)}%
                </p>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-background">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${authenticity}%` }}
              />
            </div>
          </div>
        </Link>

        <div className="mt-4 flex gap-2">
          <Button
            variant={isShortlisted ? "default" : "outline"}
            className="flex-1 border-slate-300 bg-white"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleShortlist?.(creator);
            }}
          >
            <Bookmark className="h-4 w-4" />
            {isShortlisted ? "Shortlisted" : "Shortlist"}
          </Button>
          <Button
            variant={isCompared ? "secondary" : "ghost"}
            className="flex-1 border border-slate-300 bg-white hover:bg-slate-50"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleCompare?.(creator);
            }}
          >
            <GitCompareArrows className="h-4 w-4" />
            {isCompared ? "In compare" : "Compare"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, ExternalLink } from "lucide-react";

import type { CreatorBrandMatch } from "@/lib/types/database";
import type {
  CreatorDetail,
  SocialPlatform,
} from "@/lib/types/creator-detail";
import { AddToCampaignDialog } from "@/components/creators/add-to-campaign-dialog";

import { MatchRing } from "./canva/match-ring";
import {
  PlatformPivot,
  type PlatformPivotItem,
} from "./canva/platform-pivot";
import { HeroMetrics } from "./canva/hero-metrics";
import { TabsStrip, type DeepTabId } from "./canva/tabs-strip";
import { ContentTab } from "./canva/content-tab";
import { PerformanceTab } from "./canva/performance-tab";
import { AudienceTab } from "./canva/audience-tab";
import { BrandMatchTab } from "./canva/brand-match-tab";

interface CreatorDetailViewProps {
  detail: CreatorDetail;
  brandMatch: CreatorBrandMatch | null;
  initialPlatform?: SocialPlatform;
}

const ACCENT: Record<SocialPlatform, string> = {
  instagram: "var(--ig)",
  youtube: "var(--yt)",
};

const ALL_PLATFORMS: SocialPlatform[] = ["instagram", "youtube"];

export function CreatorDetailView({
  detail,
  brandMatch,
  initialPlatform,
}: CreatorDetailViewProps) {
  const profilesByPlatform = useMemo(() => {
    const map = new Map<SocialPlatform, (typeof detail.profiles)[number]>();
    for (const p of detail.profiles) {
      if (p.platform === "instagram" || p.platform === "youtube") {
        map.set(p.platform, p);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.profiles]);

  const availablePlatforms = ALL_PLATFORMS.filter((p) => profilesByPlatform.has(p));

  const defaultPlatform =
    initialPlatform && profilesByPlatform.has(initialPlatform)
      ? initialPlatform
      : profilesByPlatform.has(detail.primary_platform)
        ? detail.primary_platform
        : (availablePlatforms[0] ?? detail.primary_platform);

  const [activePlatform, setActivePlatform] =
    useState<SocialPlatform>(defaultPlatform);
  const [activeTab, setActiveTab] = useState<DeepTabId>("content");
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const router = useRouter();

  const activeProfile = profilesByPlatform.get(activePlatform);
  const activeScores = detail.scores_by_platform[activePlatform] ?? null;
  const activeIntel =
    detail.intelligence_by_platform[activePlatform] ?? {
      caption: null,
      transcript: null,
      audience: null,
    };
  const activeContent = detail.content_by_platform[activePlatform] ?? [];

  const pivotItems: PlatformPivotItem[] = ALL_PLATFORMS.map((platform) => {
    const profile = profilesByPlatform.get(platform);
    // Fall back to constructing a profile URL from the handle when the DB
    // didn't capture one (older rows). YT supports both /@handle and
    // /channel/<id>; we prefer the explicit profile_url, then the
    // canonical channel URL, then handle-based.
    const constructedUrl = profile?.handle
      ? platform === "instagram"
        ? `https://www.instagram.com/${profile.handle}/`
        : `https://www.youtube.com/@${profile.handle}`
      : null;
    return {
      platform,
      followers: profile?.followers_or_subs ?? null,
      available: !!profile,
      profileUrl: profile?.profile_url ?? constructedUrl,
      handle: profile?.handle ?? null,
    };
  });

  const accent = ACCENT[activePlatform];

  // Header score: prefer brand match (creator-wide), fall back to CPI from
  // the first available platform so the slot is never empty when we have a
  // creator score on file.
  const cpiFallback = (() => {
    for (const p of availablePlatforms) {
      const cpi = detail.scores_by_platform[p]?.cpi;
      if (cpi != null) {
        return cpi <= 1 ? cpi * 100 : cpi;
      }
    }
    return null;
  })();
  // match_score is stored as either 0-1 (decimal) or 0-100 (percent) depending
  // on the pipeline run. Normalize to 0-100 for display.
  const normalizedMatch =
    brandMatch?.match_score != null
      ? brandMatch.match_score <= 1
        ? brandMatch.match_score * 100
        : brandMatch.match_score
      : null;
  const headerScore: { label: string; value: number } | null =
    normalizedMatch != null
      ? { label: "Brand match", value: normalizedMatch }
      : cpiFallback != null
        ? { label: "Creator CPI", value: cpiFallback }
        : null;

  const tags = [
    detail.creator.category,
    activeIntel.caption?.primary_niche,
    activeIntel.caption?.secondary_niche,
  ].filter((t): t is string => Boolean(t));

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto pb-6">
      {/* Creator header — minimal: avatar, name, niches, header score */}
      <header className="flex flex-wrap items-center gap-4 px-2 pt-1">
        {(() => {
          // Avatar source priority: canonical creators.avatar_url, then the
          // active platform's social_profile.avatar_url (covers YT-only
          // creators where the canonical column hasn't been backfilled).
          const avatarSrc =
            detail.creator.avatar_url ?? activeProfile?.avatar_url ?? null;
          return avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl border-[3px] border-card object-cover shadow-md"
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-2xl border-[3px] border-card bg-canva-purple-soft shadow-md" />
          );
        })()}
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[22px] font-extrabold leading-tight tracking-tight text-foreground">
            {detail.creator.display_name ?? detail.creator.handle}
          </h1>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-canva-purple-soft px-2.5 py-0.5 text-[11px] font-bold capitalize text-canva-purple"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* Platform profile links — visible chips that open the creator's
              IG / YT page in a new tab. Driven by pivotItems so the same
              URL-construction logic is shared with the platform pivot. */}
          {pivotItems.some((p) => p.available && p.profileUrl) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pivotItems.map((p) => {
                if (!p.available || !p.profileUrl) return null;
                const meta = {
                  instagram: { label: "Instagram", mark: "IG", bg: "var(--gradient-instagram)" },
                  youtube: { label: "YouTube", mark: "YT", bg: "var(--yt)" },
                }[p.platform];
                return (
                  <a
                    key={p.platform}
                    href={p.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open on ${meta.label}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-bold text-foreground transition-colors hover:border-canva-purple/40 hover:bg-canva-purple-soft hover:text-canva-purple"
                  >
                    <span
                      aria-hidden
                      className="grid h-4 w-4 place-items-center rounded text-[8px] font-extrabold text-white"
                      style={{ background: meta.bg }}
                    >
                      {meta.mark}
                    </span>
                    <span className="truncate max-w-[160px]">
                      {p.handle ? `@${p.handle}` : meta.label}
                    </span>
                    <ExternalLink className="size-3" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {headerScore && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
              <MatchRing score={headerScore.value} size={48} strokeWidth={4} />
              <div className="whitespace-nowrap">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {headerScore.label}
                </div>
                <div className="font-heading text-base font-extrabold leading-tight text-foreground">
                  {Math.round(headerScore.value)}
                  <span className="text-[11px] font-bold text-muted-foreground">
                    /100
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCampaignDialogOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-foreground shadow-sm transition hover:border-canva-purple/40 hover:bg-canva-purple-soft"
            >
              <Plus size={13} />
              Add to campaign
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/outreach?compose=1&creator_id=${detail.creator.id}`)
              }
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border-0 px-3.5 py-2.5 text-xs font-bold text-white shadow-md transition hover:opacity-95"
              style={{ background: "var(--gradient-canva)" }}
            >
              <Send size={13} />
              Reach out
            </button>
          </div>
        </div>
      </header>

      {/* Platform pivot + hero metrics */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <PlatformPivot
          items={pivotItems}
          active={activePlatform}
          onChange={setActivePlatform}
        />
        {activeProfile ? (
          <HeroMetrics
            followers={activeProfile.followers_or_subs}
            avgEngagementRate={
              activeScores?.avg_engagement_rate ?? activeProfile.avg_engagement
            }
            postsPerWeek={activeScores?.posts_per_week ?? null}
            content={activeContent}
          />
        ) : (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No data on {activePlatform} for this creator yet.
          </div>
        )}
      </section>

      {/* Deep tabs */}
      <TabsStrip
        active={activeTab}
        onChange={setActiveTab}
        platform={activePlatform}
      />

      <div role="tabpanel">
        {activeTab === "content" && (
          <ContentTab
            caption={activeIntel.caption}
            transcript={activeIntel.transcript}
            audience={activeIntel.audience}
            content={activeContent}
            platform={activePlatform}
            accent={accent}
          />
        )}
        {activeTab === "performance" && (
          <PerformanceTab
            scores={activeScores}
            content={activeContent}
            accent={accent}
          />
        )}
        {activeTab === "audience" && (
          <AudienceTab audience={activeIntel.audience} accent={accent} />
        )}
        {activeTab === "brand" && (
          <BrandMatchTab match={brandMatch} caption={activeIntel.caption} />
        )}
      </div>

      <AddToCampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        creatorId={detail.creator.id}
        creatorHandle={detail.creator.handle}
        matchScore={brandMatch?.match_score ?? null}
      />
    </div>
  );
}

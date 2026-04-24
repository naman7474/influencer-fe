"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw,
  ArrowRight,
  MapPin,
  ShoppingBag,
  Megaphone,
  Search,
  Plug,
  Globe,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  Target,
  Calendar,
  Users,
} from "lucide-react";

import type { Brand, BrandShopifyGeo, Campaign } from "@/lib/types/database";
import { buildBrandZoneNeeds, ZONE_LABELS, type IndiaZone } from "@/lib/geo/india";
import type { MatchWithCreator } from "./page";
import { formatCurrency } from "@/lib/format";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreatorCard, type CreatorCardCreator } from "@/components/creators/creator-card";
import { CreatorCardSkeleton, CampaignCardSkeleton } from "@/components/ui/loading-cards";
import { EmptyState } from "@/components/ui/empty-state";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface DashboardClientProps {
  brand: Brand;
  topMatches: MatchWithCreator[];
  campaigns: Campaign[];
  geoData: BrandShopifyGeo[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function matchToCreatorCard(m: MatchWithCreator): CreatorCardCreator {
  return {
    creator_id: m.creator_id,
    handle: m.creator.handle,
    display_name: m.creator.display_name,
    avatar_url: m.creator.avatar_url,
    followers: m.creator.followers ?? 0,
    tier: m.creator.tier ?? "nano",
    is_verified: m.creator.is_verified ?? false,
    city: m.creator.city,
    country: m.creator.country,
    cpi: m.creator_scores?.cpi ?? null,
    avg_engagement_rate: m.creator_scores?.avg_engagement_rate ?? null,
    engagement_trend: m.creator_scores?.engagement_trend ?? null,
    primary_niche: m.caption_intelligence?.primary_niche ?? m.creator.category ?? null,
    primary_tone: m.caption_intelligence?.primary_tone ?? null,
    primary_spoken_language: m.transcript_intelligence?.primary_spoken_language ?? null,
    audience_authenticity_score: m.audience_intelligence?.authenticity_score
      ? Math.round(m.audience_intelligence.authenticity_score * 100)
      : null,
  };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function problemTypeBadge(problemType: string | null) {
  switch (problemType) {
    case "awareness_gap":
      return (
        <Badge variant="destructive" className="text-[11px]">
          <AlertTriangle className="mr-0.5 size-3" />
          Awareness Gap
        </Badge>
      );
    case "conversion_gap":
      return (
        <Badge variant="outline" className="border-warning/50 text-warning text-[11px]">
          <Target className="mr-0.5 size-3" />
          Conversion Gap
        </Badge>
      );
    case "strong_market":
      return (
        <Badge variant="secondary" className="border-success/50 text-success text-[11px]">
          <CheckCircle className="mr-0.5 size-3" />
          Strong Market
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[11px]">
          {problemType ?? "Unknown"}
        </Badge>
      );
  }
}

function campaignStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge variant="default">Active</Badge>;
    case "draft":
      return <Badge variant="secondary">Draft</Badge>;
    case "completed":
      return <Badge variant="outline">Completed</Badge>;
    case "paused":
      return (
        <Badge variant="outline" className="border-warning/50 text-warning">
          Paused
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DashboardClient({
  brand,
  topMatches,
  campaigns,
  geoData,
}: DashboardClientProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const refreshRecommendations = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/matching/compute", { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const shopifyConnected = brand.shopify_connected;

  // Compute KPI values from available data
  const avgMatchScore = topMatches.length > 0
    ? Math.round(
        (topMatches.reduce((sum, m) => sum + (m.match_score ?? 0), 0) /
          topMatches.length) *
          100
      )
    : 0;
  const activeCampaignCount = campaigns.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-10">
      {/* ── Hero Greeting ─────────────────────────────────────────── */}
      <section>
        <h1 className="font-serif italic text-3xl leading-tight tracking-tight text-foreground md:text-4xl">
          {greeting}, {brand.brand_name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening with your creator network.
        </p>
      </section>

      {/* ── KPI Stats Row ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          label="Creators Matched"
          value={topMatches.length.toString()}
          icon={<Users className="size-4" />}
        />
        <KPICard
          label="Avg Brand-Fit"
          value={avgMatchScore > 0 ? `${avgMatchScore}%` : "---"}
          icon={<Target className="size-4" />}
        />
        <KPICard
          label="Active Campaigns"
          value={activeCampaignCount.toString()}
          icon={<Megaphone className="size-4" />}
        />
        <KPICard
          label="Geo Regions"
          value={geoData.length > 0 ? geoData.length.toString() : "---"}
          icon={<Globe className="size-4" />}
        />
      </section>

      {/* ── Top Matches ────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl leading-tight text-foreground">
            Your Top Matches
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshRecommendations}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/discover" />}>
              View All
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {isRefreshing ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[300px] snap-start">
                <CreatorCardSkeleton />
              </div>
            ))}
          </div>
        ) : topMatches.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-thin">
            {topMatches.map((match) => (
              <div key={match.id} className="shrink-0 w-[300px] snap-start">
                <CreatorCard
                  creator={matchToCreatorCard(match)}
                  matchScore={
                    match.match_score
                      ? Math.round(match.match_score * 100)
                      : null
                  }
                  matchReasons={formatMatchReasons(match)}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Search />}
            title="No matches yet"
            description="We haven't computed any creator matches for your brand yet. Click the button below to generate recommendations."
            action={{
              label: "Generate Recommendations",
              onClick: refreshRecommendations,
            }}
          />
        )}
      </section>

      {/* ── Geo Insights ───────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl leading-tight text-foreground">
            Geographic Insights
          </h2>
          {shopifyConnected && geoData.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Globe className="size-3" />
              {geoData.length} regions analyzed
            </Badge>
          )}
        </div>

        {shopifyConnected && geoData.length > 0 ? (
          <div className="space-y-4">
            {!geoData.some((r) => (r.sessions ?? 0) > 0) && (
              <p className="text-xs text-muted-foreground">
                Session and conversion-rate stats require Shopify Plus.
                Classifications below are based on orders and population.
              </p>
            )}
            {/* Zone summary cards */}
            <ZoneSummary geoData={geoData} brand={brand} />

            {/* Per-region detail cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {geoData.map((region) => {
              const regionName = [region.city, region.state, region.country]
                .filter(Boolean)
                .join(", ");
              // gap_score is stored as a signed 0-1 float; a positive
              // value means under-indexed vs population. Scale to 0-100
              // for display and clamp negative values to 0.
              const gapPercent = Math.round(
                Math.max(0, Math.min(1, region.gap_score ?? 0)) * 100
              );
              const hasSessions =
                region.sessions != null && region.sessions > 0;
              const hasCvr =
                region.conversion_rate != null && region.conversion_rate > 0;

              return (
                <Card key={region.id} className="overflow-hidden">
                  <CardContent className="space-y-2.5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {regionName || "Unknown Region"}
                        </span>
                      </div>
                      {problemTypeBadge(region.problem_type)}
                    </div>

                    {/* Gap / Opportunity score bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {region.problem_type === "strong_market"
                            ? "Market Strength"
                            : "Gap Score"}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {gapPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            region.problem_type === "awareness_gap"
                              ? "bg-destructive"
                              : region.problem_type === "conversion_gap"
                                ? "bg-warning"
                                : "bg-success"
                          }`}
                          style={{ width: `${gapPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {hasSessions && (
                        <span>
                          Sessions:{" "}
                          <span className="font-mono font-medium text-foreground">
                            {region.sessions!.toLocaleString()}
                          </span>
                        </span>
                      )}
                      {region.orders != null && (
                        <span>
                          Orders:{" "}
                          <span className="font-mono font-medium text-foreground">
                            {region.orders.toLocaleString()}
                          </span>
                        </span>
                      )}
                      {hasCvr && (
                        <span>
                          CVR:{" "}
                          <span className="font-mono font-medium text-foreground">
                            {(region.conversion_rate! * 100).toFixed(1)}%
                          </span>
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          </div>
        ) : shopifyConnected ? (
          <EmptyState
            icon={<Globe />}
            title="No geographic data yet"
            description="Your Shopify store is connected but no geographic data has been analyzed yet. Data will appear after the next sync."
          />
        ) : (
          <Card className="border-dashed border-muted-foreground/30">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Connect Shopify for Geographic Insights
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Link your Shopify store to unlock geographic intelligence.
              </p>
              <Button
                className="mt-4"
                render={<Link href="/onboarding/integrations" />}
              >
                <Plug className="size-4" />
                Connect Shopify
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Active Campaigns ───────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl leading-tight text-foreground">
            Active Campaigns
          </h2>
          <Button variant="ghost" size="sm" render={<Link href="/campaigns" />}>
            View All
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        {campaigns.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="group"
              >
                <Card className="transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
                  <CardContent className="space-y-3 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {campaign.name}
                      </h3>
                      {campaignStatusBadge(campaign.status)}
                    </div>

                    {campaign.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {campaign.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {campaign.goal && (
                        <span className="inline-flex items-center gap-1">
                          <Target className="size-3" />
                          <span className="capitalize">{campaign.goal.replace("_", " ")}</span>
                        </span>
                      )}
                      {campaign.total_budget != null && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <TrendingUp className="size-3" />
                          {formatCurrency(campaign.total_budget, campaign.currency ?? "INR")}
                        </span>
                      )}
                      {campaign.start_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(campaign.start_date).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>

                    {/* Target tiers / niches */}
                    {(campaign.target_niches?.length || campaign.target_tiers?.length) && (
                      <div className="flex flex-wrap gap-1">
                        {campaign.target_niches?.slice(0, 3).map((niche) => (
                          <Badge key={niche} variant="secondary" className="text-[10px]">
                            {niche}
                          </Badge>
                        ))}
                        {campaign.target_tiers?.slice(0, 3).map((tier) => (
                          <Badge key={tier} variant="outline" className="text-[10px] capitalize">
                            {tier}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Megaphone />}
            title="No campaigns yet"
            description="Create your first campaign to start finding and managing creator partnerships."
            action={{ label: "Create Campaign", href: "/campaigns/new" }}
          />
        )}
      </section>

      {/* ── Quick Actions ──────────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap gap-3">
          <Button render={<Link href="/campaigns/new" />}>
            <Megaphone className="size-4" />
            Create Campaign
          </Button>
          <Button variant="outline" render={<Link href="/discover" />}>
            <Search className="size-4" />
            Discover Creators
          </Button>
          {!shopifyConnected && (
            <Button
              variant="outline"
              render={<Link href="/onboarding/integrations" />}
            >
              <Plug className="size-4" />
              Connect Shopify
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KPICard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <p className="text-xs">{label}</p>
        </div>
        <p className="mt-1 font-mono text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Match reasoning formatter                                          */
/* ------------------------------------------------------------------ */

function formatMatchReasons(match: MatchWithCreator): string {
  const reasons: string[] = [];

  if (match.niche_fit_score != null && match.niche_fit_score >= 0.8) {
    reasons.push("Strong niche fit");
  } else if (match.niche_fit_score != null && match.niche_fit_score >= 0.5) {
    reasons.push("Adjacent niche");
  }

  if (
    match.audience_geo_score != null &&
    match.audience_geo_score >= 0.7
  ) {
    reasons.push("Geo-aligned audience");
  }

  if (
    match.engagement_score != null &&
    match.engagement_score >= 0.7
  ) {
    reasons.push("High engagement");
  }

  if (match.already_mentions_brand) {
    reasons.push("Already mentions brand");
  }

  if (match.mentions_competitor) {
    reasons.push("Mentions competitor");
  }

  return reasons.join("|");
}

/* ------------------------------------------------------------------ */
/*  Zone Summary                                                       */
/* ------------------------------------------------------------------ */

const ZONE_COLORS: Record<IndiaZone, string> = {
  north: "bg-[var(--db-clay)]",
  south: "bg-success",
  east: "bg-warning",
  west: "bg-[#5b9bd5]",
};

function ZoneSummary({ geoData, brand }: { geoData: BrandShopifyGeo[]; brand: Brand }) {
  const targetZones = (brand.shipping_zones ?? [])
    .map((z) => {
      const key = z.toLowerCase().replace(" india", "");
      if (["north", "south", "east", "west"].includes(key)) return key as IndiaZone;
      return null;
    })
    .filter((z): z is IndiaZone => z !== null);

  const brandNeeds = buildBrandZoneNeeds(geoData, targetZones.length > 0 ? targetZones : undefined);

  return (
    <div className="grid grid-cols-4 gap-2">
      {(["north", "south", "east", "west"] as IndiaZone[]).map((zone) => {
        const need = brandNeeds[zone];
        const oppPercent = Math.round(need.opportunity * 100);
        const isTarget = targetZones.includes(zone);

        return (
          <div
            key={zone}
            className={`relative rounded-xl border p-3 text-center transition-all ${
              isTarget ? "border-primary/50 bg-primary/5" : "border-border"
            }`}
          >
            <div className={`mx-auto mb-1.5 h-1 w-8 rounded-full ${ZONE_COLORS[zone]}`} />
            <p className="text-xs font-semibold text-foreground">
              {ZONE_LABELS[zone].replace(" India", "")}
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold text-foreground">
              {oppPercent}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              {need.type === "gap"
                ? "Gap"
                : need.type === "target"
                  ? "Target"
                  : "Strong"}
            </p>
            {isTarget && (
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                T
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

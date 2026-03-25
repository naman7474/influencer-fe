import Link from "next/link";
import { ArrowRight, MapPinned, ShoppingBag, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireBrandContext } from "@/lib/queries/brand";
import { getDashboardOverview } from "@/lib/queries/dashboard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { SegmentedBar } from "@/components/shared/visuals";
import { formatNumber, humanize } from "@/lib/constants";
import { cn } from "@/lib/utils";

const primaryActionClassName = cn(
  "group/button inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-primary px-2.5 text-sm font-medium whitespace-nowrap text-primary-foreground transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
);

const secondaryActionClassName = cn(
  "group/button inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
);

export default async function DashboardPage() {
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);
  const overview = await getDashboardOverview(supabase, brand.brand_id);
  const isShopifySyncing =
    brand.shopify_sync_status === "queued" || brand.shopify_sync_status === "running";

  return (
    <div className="space-y-6">
      <section>
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Welcome back, {brand.brand_name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Your creator network, campaigns, and market opportunities at a glance.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/discover" className={primaryActionClassName}>
                Open creator discovery
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={brand.shopify_connected ? "/geo" : "/settings"}
                className={secondaryActionClassName}
              >
                {brand.shopify_connected ? "Review geo intelligence" : "Connect Shopify"}
              </Link>
            </div>
          </div>

          <Card className="border bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-primary-foreground">Top geo opportunity</CardTitle>
              <CardDescription className="text-primary-foreground/60">
                Your biggest untapped market right now.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.summary.top_geo_opportunity ? (
                <>
                  <div>
                    <p className="text-xs text-primary-foreground/60">
                      {humanize(overview.summary.top_geo_opportunity.problem_type)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {overview.summary.top_geo_opportunity.region_name}
                    </p>
                  </div>
                  <div className="rounded-md bg-primary-foreground/10 px-3 py-1.5 text-sm">
                    Gap score {Math.round(overview.summary.top_geo_opportunity.gap_score)}
                  </div>
                </>
              ) : (
                <div className="rounded-md bg-primary-foreground/10 px-3 py-3 text-sm">
                  {isShopifySyncing
                    ? "Shopify sync is running. Geo insights will appear shortly."
                    : brand.shopify_connected
                    ? "Geo data is being processed."
                    : "Connect Shopify to unlock geo insights."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Campaigns"
          value={String(overview.summary.active_campaigns)}
          subtext="Currently running campaigns."
          icon={<Sparkles className="h-5 w-5" />}
        />
        <StatCard
          label="Creators In Pipeline"
          value={String(overview.summary.creators_in_pipeline)}
          subtext="Across all active campaigns."
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Shortlist"
          value={String(overview.shortlist_count)}
          subtext="Saved from discovery and recommendations."
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="ROI Snapshot"
          value={
            overview.summary.avg_campaign_roi != null
              ? `${overview.summary.avg_campaign_roi.toFixed(1)}x`
              : "N/A"
          }
          subtext="Average return across campaigns."
          icon={<MapPinned className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>Active campaigns summary</CardTitle>
            <CardDescription>
              Campaign progress and creator workflow status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.active_campaigns.length > 0 ? (
              overview.active_campaigns.map((campaign) => (
                <div
                  key={campaign.campaign_id}
                  className="rounded-lg bg-muted/50 p-3"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {campaign.name}
                        </p>
                        <Badge variant="secondary">{campaign.goal}</Badge>
                        <Badge variant="outline">{campaign.status}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {campaign.creators} creators in workflow
                      </p>
                    </div>
                    <div className="min-w-[220px]">
                      <SegmentedBar segments={campaign.split} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No campaigns yet. Create one from the campaigns page once your shortlist is ready.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>Geo alerts</CardTitle>
            <CardDescription>
              Market gaps and opportunities from your Shopify data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {overview.geo_alerts.length > 0 ? (
              overview.geo_alerts.map((alert) => (
                <div key={alert.region} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2">
                    <Badge className={alert.tone}>{humanize(alert.type)}</Badge>
                    <p className="text-sm font-medium text-foreground">{alert.region}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.note}</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                {brand.shopify_connected
                  ? isShopifySyncing
                    ? "Shopify sync is running. Geo alerts will appear shortly."
                    : "Geo data is being processed."
                  : "Connect Shopify to unlock geo gap alerts."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>Top matched creators</CardTitle>
            <CardDescription>
              Best creator matches based on your brand profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {overview.top_matches.length > 0 ? (
              overview.top_matches.map((row) => (
                <div key={row.creator_id} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={row.creator?.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {(row.creator?.handle ?? "cr").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/creators/${row.creator?.handle ?? ""}`}
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          @{row.creator?.handle ?? "unknown"}
                        </Link>
                        <Badge variant="secondary">
                          Match {Math.round(Number(row.match_score ?? 0))}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.creator?.display_name || "Unnamed creator"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.match_reasoning || `Recommended for ${row.recommended_for}.`}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                Creator matches will appear after your brand profile and Shopify data are set up.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>Shopify products</CardTitle>
            <CardDescription>
              Products from your Shopify store used for creator matching.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {overview.products.length > 0 ? (
              overview.products.map((product) => (
                <div key={product.id} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{product.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.product_type || "Uncategorized"} · ₹
                        {formatNumber(Number(product.min_price ?? 0))}
                        {product.max_price && product.max_price !== product.min_price
                          ? ` - ₹${formatNumber(Number(product.max_price))}`
                          : ""}
                      </p>
                    </div>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                {brand.shopify_connected
                  ? "No Shopify products have been synced yet."
                  : "Connect Shopify to sync your product catalogue."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

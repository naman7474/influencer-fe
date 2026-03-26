import Link from "next/link";
import { ArrowUpRight, LoaderCircle, MapPinned, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireBrandContext } from "@/lib/queries/brand";
import { getGeoOverview } from "@/lib/queries/geo";
import { humanize } from "@/lib/constants";

function GeoStatusBanner({
  tone,
  icon,
  title,
  description,
  ctaLabel,
}: {
  tone: "default" | "warning" | "error";
  icon?: React.ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
}) {
  const toneClassName =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-border bg-muted/40 text-foreground";

  return (
    <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${toneClassName}`}>
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-sm opacity-80">{description}</p>
        </div>
      </div>
      {ctaLabel ? (
        <Link href="/settings">
          <Button size="sm" variant="outline">
            {ctaLabel}
          </Button>
        </Link>
      ) : null}
    </div>
  );
}

function EmptyGeoState({
  title,
  description,
  ctaLabel,
}: {
  title: string;
  description: string;
  ctaLabel: string;
}) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-background text-muted-foreground">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <p className="mt-4 text-lg font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Link href="/settings" className="mt-5 inline-flex">
          <Button>{ctaLabel}</Button>
        </Link>
      </div>
    </div>
  );
}

export default async function GeoPage() {
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);
  const geo = await getGeoOverview(supabase, brand.brand_id);
  const isSyncing =
    geo.sync_status === "queued" || geo.sync_status === "running";

  if (!geo.shopify_connected) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Geo Intelligence
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Regional performance and creator recommendations
          </h1>
          <GeoStatusBanner
            tone="default"
            title="Connect Shopify to unlock geo intelligence."
            description="Geo scoring needs live Shopify sessions, orders, and revenue data before it can surface market gaps."
            ctaLabel="Go to Settings"
          />
        </section>

        <EmptyGeoState
          title="No geo data yet"
          description="Connect a Shopify store and run the first sync to generate opportunity regions and regional creator recommendations."
          ctaLabel="Connect Shopify"
        />
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Geo Intelligence
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Regional performance and creator recommendations
          </h1>
          <GeoStatusBanner
            tone="warning"
            icon={<LoaderCircle className="h-4 w-4 animate-spin" />}
            title="Shopify sync in progress..."
            description="We are pulling the latest store data. Geo opportunities and recommendations will populate as soon as sync completes."
            ctaLabel="Manage Shopify"
          />
        </section>

        <EmptyGeoState
          title="Syncing Shopify data"
          description="This page will fill in automatically after the background sync finishes."
          ctaLabel="Open Settings"
        />
      </div>
    );
  }

  if (geo.sync_status === "failed" && geo.rows.length === 0) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Geo Intelligence
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Regional performance and creator recommendations
          </h1>
          <GeoStatusBanner
            tone="error"
            title="Sync failed."
            description={geo.sync_error || "The last Shopify sync did not complete. Check the store URL and token, then retry from settings."}
            ctaLabel="Retry in Settings"
          />
        </section>

        <EmptyGeoState
          title="Geo sync needs attention"
          description="Update the Shopify connection and rerun sync before this page can show regional gaps."
          ctaLabel="Open Settings"
        />
      </div>
    );
  }

  const showEmptySyncedState = geo.rows.length === 0;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          Geo Intelligence
        </p>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Regional performance and creator recommendations
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Market opportunities based on your Shopify orders and session data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">
              {geo.rows.length} regions
            </Badge>
            <span>
              Last synced:{" "}
              {geo.last_sync_at
                ? new Date(geo.last_sync_at).toLocaleString()
                : "Not yet"}
            </span>
            <Link href="/settings">
              <Button size="sm" variant="outline">
                Manage Shopify
              </Button>
            </Link>
          </div>
        </div>
        {geo.sync_status === "failed" ? (
          <GeoStatusBanner
            tone="error"
            title="Latest sync failed."
            description={geo.sync_error || "Some geo data may be stale until the next successful sync."}
            ctaLabel="Retry in Settings"
          />
        ) : null}
      </section>

      {showEmptySyncedState ? (
        <EmptyGeoState
          title="No regional rows yet"
          description="The store is connected, but the sync has not produced geo rows yet. Trigger another sync from settings if needed."
          ctaLabel="Manage Shopify"
        />
      ) : null}

      {!showEmptySyncedState ? (
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>Opportunity map</CardTitle>
            <CardDescription>
              Top regions ranked by gap score.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {geo.regions.map((region) => (
              <div key={region.name} className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{region.name}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${region.tone}`}>
                    {region.value}
                  </span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${region.value}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>Gap analysis table</CardTitle>
            <CardDescription>
              Regional performance breakdown by sessions, orders, and revenue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {geo.rows.map((row) => (
              <div key={row.id} className="rounded-lg bg-muted/50 p-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPinned className="h-4 w-4 text-slate-500" />
                      <p className="text-sm font-medium text-foreground">
                        {[row.city, row.state].filter(Boolean).join(", ") || "Unknown region"}
                      </p>
                      <Badge variant="secondary">{humanize(row.problem_type)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Gap score {Math.round(Number(row.gap_score ?? 0) * 100)} with revenue ₹
                      {Math.round(Number(row.revenue ?? 0))}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Sessions {row.sessions ?? 0}</p>
                    <p>Orders {row.orders ?? 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      ) : null}

      {!showEmptySyncedState ? (
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle>Region to creator recommendations</CardTitle>
          <CardDescription>
            Best-fit creators for each priority region.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {geo.recommendations.map((item) => (
            <div key={item.region} className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium text-foreground">{item.region}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.fit}</p>
              {item.creators.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {item.creators.map((creatorMatch) =>
                    creatorMatch.creator?.handle ? (
                      <div
                        key={creatorMatch.creator_id}
                        className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          @{creatorMatch.creator.handle}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(Number(creatorMatch.match_score ?? 0))} match
                        </span>
                      </div>
                    ) : null
                  )}

                  <Link
                    href={`/discover?sortBy=match_score&geoRegion=${encodeURIComponent(
                      item.region_name
                    )}`}
                    className="inline-flex"
                  >
                    <Button variant="ghost" className="mt-2">
                      Explore recommendations
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}

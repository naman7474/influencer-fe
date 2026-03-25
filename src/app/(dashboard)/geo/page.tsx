import Link from "next/link";
import { ArrowUpRight, MapPinned, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreRing } from "@/components/shared/visuals";
import { createClient } from "@/lib/supabase/server";
import { requireBrandContext } from "@/lib/queries/brand";
import { getGeoOverview } from "@/lib/queries/geo";
import { humanize } from "@/lib/constants";

export default async function GeoPage() {
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);
  const geo = await getGeoOverview(supabase, brand.brand_id);
  const isSyncing =
    geo.sync_status === "queued" || geo.sync_status === "running";

  if (!geo.shopify_connected) {
    return (
      <div className="space-y-6">
        <section className="space-y-1">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Geo Intelligence
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                Geo matching needs Shopify store data.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Without Shopify, there are no sessions, orders, or market gaps to score. Connect a store or add an admin access token in settings first.
              </p>
            </div>

            <Card className="border bg-primary text-primary-foreground">
              <CardHeader>
                <CardTitle className="text-primary-foreground">Shopify connection</CardTitle>
                <CardDescription className="text-primary-foreground/60">
                  Geo scoring turns live after store sync.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-6">
                <ScoreRing
                  value={28}
                  label="Setup progress"
                  sublabel="Shopify missing"
                  tone="#6366f1"
                />
                <Link href="/settings">
                  <Button size="lg" variant="secondary">
                    <ShoppingBag className="h-4 w-4" />
                    Connect Shopify
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="space-y-6">
        <section className="space-y-1">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Geo Intelligence
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                Shopify sync is running.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                We are pulling the latest orders, analytics sessions, and products from Shopify. Geo opportunity and creator recommendations will populate after the sync finishes.
              </p>
            </div>

            <Card className="border bg-primary text-primary-foreground">
              <CardHeader>
                <CardTitle className="text-primary-foreground">Background sync</CardTitle>
                <CardDescription className="text-primary-foreground/60">
                  Store {geo.store_url || "connected"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-6">
                <ScoreRing
                  value={64}
                  label="Sync status"
                  sublabel={geo.sync_status === "queued" ? "Queued" : "Running"}
                  tone="#6366f1"
                />
                <Link href="/settings">
                  <Button size="lg" variant="secondary">
                    <ShoppingBag className="h-4 w-4" />
                    Manage Shopify
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  if (geo.sync_status === "failed" && geo.rows.length === 0) {
    return (
      <div className="space-y-6">
        <section className="space-y-1">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Geo Intelligence
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                Shopify sync failed.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {geo.sync_error || "The last Shopify sync did not complete. Check the store URL and admin token, then retry from settings."}
              </p>
            </div>

            <Card className="border bg-primary text-primary-foreground">
              <CardHeader>
                <CardTitle className="text-primary-foreground">Retry sync</CardTitle>
                <CardDescription className="text-primary-foreground/60">
                  Update credentials or trigger a fresh sync.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-6">
                <ScoreRing
                  value={18}
                  label="Sync status"
                  sublabel="Failed"
                  tone="#ef4444"
                />
                <Link href="/settings">
                  <Button size="lg" variant="secondary">
                    <ShoppingBag className="h-4 w-4" />
                    Open settings
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Geo Intelligence
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Regional performance and creator recommendations
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Market opportunities based on your Shopify orders and session data.
            </p>
          </div>

          <Card className="border bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-primary-foreground">Shopify sync</CardTitle>
              <CardDescription className="text-primary-foreground/60">
                Store {geo.store_url || "connected"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-6">
              <ScoreRing
                value={geo.rows.length > 0 ? 88 : 52}
                label="Geo readiness"
                sublabel={geo.last_sync_at ? "Synced" : "Awaiting first sync"}
                tone="#22c55e"
              />
              <Link href="/settings">
                <Button size="lg" variant="secondary">
                  <ShoppingBag className="h-4 w-4" />
                  Manage Shopify
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

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
    </div>
  );
}

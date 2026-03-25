import { CheckCircle2, ClipboardList, Coins, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { ScoreRing, SegmentedBar } from "@/components/shared/visuals";
import { createClient } from "@/lib/supabase/server";
import { requireBrandContext } from "@/lib/queries/brand";
import { getCampaignsOverview } from "@/lib/queries/campaigns";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);
  const overview = await getCampaignsOverview(supabase, brand.brand_id);

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-medium text-muted-foreground">
              Campaigns
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Campaigns
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your influencer campaigns and track performance.
            </p>
          </div>

          <Button size="lg">
            <Megaphone className="h-4 w-4" />
            Create campaign
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Campaigns"
          value={String(overview.summary.activeCampaigns)}
          subtext="Currently running campaigns"
          icon={<Megaphone className="h-5 w-5" />}
        />
        <StatCard
          label="Creators In Pipeline"
          value={String(overview.summary.creatorsInPipeline)}
          subtext="Shortlisted, contacted, or confirmed"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          label="Projected ROI"
          value={
            overview.summary.projectedRoi != null
              ? `${overview.summary.projectedRoi.toFixed(1)}x`
              : "N/A"
          }
          subtext="Average return on investment"
          icon={<Coins className="h-5 w-5" />}
        />
        <StatCard
          label="Completion Rate"
          value={`${overview.summary.completionRate}%`}
          subtext="Completed creator assignments"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>Campaign list</CardTitle>
            <CardDescription>
              All campaigns and their current status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {overview.campaigns.length > 0 ? (
              overview.campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {campaign.name}
                        </p>
                        <Badge variant="secondary">{campaign.goal}</Badge>
                        <Badge variant="outline">{campaign.status}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {campaign.creators} creators · ROI {campaign.roi || "N/A"}x
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
                No campaigns exist yet for this brand.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border bg-card">
            <CardHeader>
              <CardTitle>Campaign wizard status</CardTitle>
              <CardDescription>
                Steps to launch a new campaign.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Goal and budget",
                "Targeting by region, niche, and tier",
                "Creator shortlist selection",
                "Review and launch",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-3"
                >
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium text-foreground">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border bg-card">
            <CardHeader>
              <CardTitle>Performance snapshot</CardTitle>
              <CardDescription>
                Aggregated ROI and completion signal.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-6">
              <ScoreRing
                value={overview.summary.completionRate}
                label="Completion rate"
                sublabel="Creator assignments completed"
                tone="#6366f1"
              />
              <div className="grid flex-1 gap-3">
                <div className="rounded-lg bg-muted/50 px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    Projected ROI
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {overview.summary.projectedRoi != null
                      ? `${overview.summary.projectedRoi.toFixed(1)}x`
                      : "N/A"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    Pipeline creators
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {overview.summary.creatorsInPipeline}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

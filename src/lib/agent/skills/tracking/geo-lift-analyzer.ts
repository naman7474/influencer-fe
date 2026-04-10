import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function geoLiftAnalyzerTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "Analyze geographic lift for a campaign by comparing pre-campaign and post-campaign Shopify data across regions. Shows which cities/regions saw improvements in sessions, orders, and revenue. Use when the user asks about 'geographic impact', 'geo lift', 'regional performance', or 'which cities improved'.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
    }),
    execute: async (params) => {
      // 1. Verify campaign
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select("id, name, start_date, end_date, status")
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign) return { error: "Campaign not found or access denied" };

      // 2. Get geo snapshots
      const { data: snapshotsRaw } = await supabase
        .from("campaign_geo_snapshots")
        .select("*")
        .eq("campaign_id", params.campaign_id)
        .order("created_at", { ascending: true });
      const snapshots = (snapshotsRaw || []) as Record<string, unknown>[];

      if (snapshots.length === 0) {
        return {
          campaign: campaign.name,
          message:
            "No geographic snapshots found. Snapshots are created at campaign start and end to measure lift.",
          suggestion:
            campaign.status === "active"
              ? "A pre-campaign snapshot should have been taken at campaign start. A post-campaign snapshot will be taken when the campaign ends."
              : "Geographic snapshots were not captured for this campaign.",
        };
      }

      // 3. Separate pre and post snapshots
      const preSnapshots = snapshots.filter(
        (s) => s.snapshot_type === "pre_campaign"
      );
      const postSnapshots = snapshots.filter(
        (s) => s.snapshot_type === "post_campaign"
      );

      if (preSnapshots.length === 0 || postSnapshots.length === 0) {
        return {
          campaign: campaign.name,
          has_pre_snapshot: preSnapshots.length > 0,
          has_post_snapshot: postSnapshots.length > 0,
          message: `Missing ${preSnapshots.length === 0 ? "pre-campaign" : "post-campaign"} snapshot. Both are needed for lift analysis.`,
          available_data: snapshots.map((s) => ({
            type: s.snapshot_type,
            city: s.city,
            sessions: s.sessions,
            orders: s.orders,
            revenue: s.revenue,
          })),
        };
      }

      // 4. Match pre/post by region and calculate lift
      const preMap = new Map<string, Record<string, unknown>>();
      for (const s of preSnapshots) {
        const key = `${s.city}|${s.state}`;
        preMap.set(key, s);
      }

      const regions: Record<string, unknown>[] = [];
      for (const post of postSnapshots) {
        const key = `${post.city}|${post.state}`;
        const pre = preMap.get(key);

        if (!pre) continue;

        const sessionLift = calcLift(
          pre.sessions as number,
          post.sessions as number
        );
        const orderLift = calcLift(
          pre.orders as number,
          post.orders as number
        );
        const revenueLift = calcLift(
          pre.revenue as number,
          post.revenue as number
        );

        regions.push({
          city: post.city,
          state: post.state,
          pre_campaign: {
            sessions: pre.sessions,
            orders: pre.orders,
            revenue: pre.revenue,
            conversion_rate: pre.conversion_rate,
          },
          post_campaign: {
            sessions: post.sessions,
            orders: post.orders,
            revenue: post.revenue,
            conversion_rate: post.conversion_rate,
          },
          lift: {
            sessions_percent: sessionLift,
            orders_percent: orderLift,
            revenue_percent: revenueLift,
          },
          status: classifyLift(sessionLift, orderLift, revenueLift),
        });
      }

      // Sort by revenue lift
      regions.sort(
        (a, b) =>
          ((b.lift as Record<string, number>).revenue_percent || 0) -
          ((a.lift as Record<string, number>).revenue_percent || 0)
      );

      // 5. Aggregate summary
      const liftRegions = regions.filter((r) => r.status === "lift");
      const flatRegions = regions.filter((r) => r.status === "flat");
      const declineRegions = regions.filter((r) => r.status === "decline");

      return {
        campaign: campaign.name,
        campaign_dates: {
          start: campaign.start_date,
          end: campaign.end_date,
        },
        regions,
        summary: {
          total_regions: regions.length,
          regions_with_lift: liftRegions.length,
          flat_regions: flatRegions.length,
          declining_regions: declineRegions.length,
        },
        top_performing_region:
          regions.length > 0
            ? {
                city: regions[0].city,
                revenue_lift: (regions[0].lift as Record<string, number>)
                  .revenue_percent,
              }
            : null,
      };
    },
  });
}

function calcLift(pre: number, post: number): number {
  if (!pre || pre === 0) return post > 0 ? 100 : 0;
  return Math.round(((post - pre) / pre) * 100 * 10) / 10;
}

function classifyLift(
  sessionLift: number,
  orderLift: number,
  revenueLift: number
): string {
  const avg = (sessionLift + orderLift + revenueLift) / 3;
  if (avg > 10) return "lift";
  if (avg < -10) return "decline";
  return "flat";
}

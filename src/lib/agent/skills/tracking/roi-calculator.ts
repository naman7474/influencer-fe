import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function roiCalculatorTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "Calculate ROI and performance metrics for a campaign, including per-creator breakdown and attribution analysis. Use when the user asks about 'ROI', 'campaign performance', 'how is the campaign doing', or 'return on investment'.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
      include_timeseries: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include daily revenue timeseries data"),
    }),
    execute: async (params) => {
      // 1. Verify campaign
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select("id, name, budget, start_date, end_date, status")
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign) return { error: "Campaign not found or access denied" };

      // 2. Get per-creator performance
      const { data: perfRaw } = await supabase
        .from("campaign_performance_summary")
        .select("*")
        .eq("campaign_id", params.campaign_id);
      const perf = (perfRaw || []) as Record<string, unknown>[];

      if (perf.length === 0) {
        return {
          campaign: campaign.name,
          status: campaign.status,
          message:
            "No performance data yet. Orders need to come in via discount codes or UTM links.",
          kpis: {
            total_spend: 0,
            total_revenue: 0,
            total_orders: 0,
            roi: 0,
          },
        };
      }

      // 3. Load creator details for the performance records
      const creatorIds = perf.map((p) => p.creator_id as string);
      const { data: creatorsRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select("creator_id, handle, display_name, tier, followers")
        .in("creator_id", creatorIds);
      const creators = (creatorsRaw || []) as Record<string, unknown>[];
      const creatorMap = new Map(creators.map((c) => [c.creator_id as string, c]));

      // 4. Aggregate KPIs
      let totalSpend = 0;
      let totalRevenue = 0;
      let totalOrders = 0;
      let discountOrders = 0;
      let utmOrders = 0;
      let bothOrders = 0;

      const perCreator = perf.map((p) => {
        const creator = creatorMap.get(p.creator_id as string);
        const spend = (p.creator_cost as number) || 0;
        const revenue = (p.total_revenue as number) || 0;
        const orders = (p.total_orders as number) || 0;

        totalSpend += spend;
        totalRevenue += revenue;
        totalOrders += orders;
        discountOrders += (p.discount_orders as number) || 0;
        utmOrders += (p.utm_orders as number) || 0;
        bothOrders += (p.both_orders as number) || 0;

        return {
          creator_id: p.creator_id,
          handle: creator?.handle ?? p.creator_id,
          display_name: creator?.display_name,
          tier: creator?.tier,
          spend,
          revenue,
          orders,
          roi: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0,
          cost_per_order: orders > 0 ? Math.round(spend / orders) : 0,
          attribution: {
            discount: (p.discount_orders as number) || 0,
            utm: (p.utm_orders as number) || 0,
            both: (p.both_orders as number) || 0,
          },
        };
      });

      // Sort by ROI descending
      perCreator.sort((a, b) => b.roi - a.roi);

      const result: Record<string, unknown> = {
        campaign: campaign.name,
        status: campaign.status,
        budget: campaign.budget,
        kpis: {
          total_spend: totalSpend,
          total_revenue: totalRevenue,
          total_orders: totalOrders,
          roi: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0,
          cost_per_order:
            totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0,
          budget_utilization:
            campaign.budget
              ? Math.round((totalSpend / (campaign.budget as number)) * 100)
              : null,
        },
        attribution_breakdown: {
          discount_orders: discountOrders,
          utm_orders: utmOrders,
          both_orders: bothOrders,
        },
        per_creator: perCreator,
        top_performer:
          perCreator.length > 0
            ? {
                handle: perCreator[0].handle,
                roi: perCreator[0].roi,
                revenue: perCreator[0].revenue,
              }
            : null,
      };

      // 5. Optional timeseries
      if (params.include_timeseries) {
        const { data: ordersRaw } = await supabase
          .from("attributed_orders")
          .select("order_total, ordered_at, attribution_type")
          .eq("campaign_id", params.campaign_id)
          .order("ordered_at", { ascending: true });
        const orders = (ordersRaw || []) as Record<string, unknown>[];

        const dailyMap = new Map<
          string,
          { revenue: number; orders: number }
        >();
        for (const o of orders) {
          const date = (o.ordered_at as string)?.slice(0, 10) ?? "unknown";
          const existing = dailyMap.get(date) || { revenue: 0, orders: 0 };
          existing.revenue += (o.order_total as number) || 0;
          existing.orders += 1;
          dailyMap.set(date, existing);
        }

        result.timeseries = [...dailyMap.entries()].map(([date, d]) => ({
          date,
          revenue: d.revenue,
          orders: d.orders,
        }));
      }

      return result;
    },
  });
}

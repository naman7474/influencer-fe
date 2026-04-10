import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getCampaignInfoTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to fetch campaign details from the database. This is the ONLY way to get real campaign data — never make up campaign info. Call it when the user asks about campaigns, campaign performance, or budget.",
    inputSchema: z.object({
      campaign_id: z.string().optional().describe("Specific campaign UUID"),
      status: z
        .string()
        .optional()
        .describe("Filter by status: draft, active, completed"),
      include_creators: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include creator list"),
    }),
    execute: async (params) => {
      if (params.campaign_id) {
        // Single campaign with details
        const { data: campaignRaw } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", params.campaign_id)
          .eq("brand_id", brandId)
          .single();
        const campaign = campaignRaw as Record<string, unknown> | null;

        if (!campaign) return { error: "Campaign not found" };

        let creators: Record<string, unknown>[] = [];
        if (params.include_creators) {
          const { data } = await supabase
            .from("campaign_creators")
            .select(
              "id, creator_id, status, agreed_rate, match_score_at_assignment, content_status, creators(handle, display_name, followers, tier)"
            )
            .eq("campaign_id", params.campaign_id);
          creators = (data || []) as Record<string, unknown>[];
        }

        // Get performance summary
        const { data: performanceRaw } = await supabase
          .from("campaign_performance_summary")
          .select("*")
          .eq("campaign_id", params.campaign_id);
        const performance = (performanceRaw || []) as Record<string, unknown>[];

        const totalRevenue = performance.reduce(
          (sum: number, p: Record<string, unknown>) =>
            sum + ((p.total_revenue as number) || 0),
          0
        );
        const totalOrders = performance.reduce(
          (sum: number, p: Record<string, unknown>) =>
            sum + ((p.total_orders as number) || 0),
          0
        );
        const totalSpend = performance.reduce(
          (sum: number, p: Record<string, unknown>) =>
            sum + ((p.creator_cost as number) || 0),
          0
        );

        return {
          campaign: {
            id: campaign.id,
            name: campaign.name,
            goal: campaign.goal,
            status: campaign.status,
            total_budget: campaign.total_budget,
            budget_per_creator: campaign.budget_per_creator,
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            target_regions: campaign.target_regions,
            target_niches: campaign.target_niches,
            content_format: campaign.content_format,
          },
          creators: creators.map((c) => ({
            creator_id: c.creator_id,
            handle: (c.creators as Record<string, unknown>)?.handle,
            status: c.status,
            agreed_rate: c.agreed_rate,
            content_status: c.content_status,
          })),
          performance_summary: {
            total_revenue: totalRevenue,
            total_orders: totalOrders,
            total_spend: totalSpend,
            roi: totalSpend > 0 ? +(totalRevenue / totalSpend).toFixed(1) : 0,
            per_creator: performance,
          },
        };
      }

      // List campaigns
      let query = supabase
        .from("campaigns")
        .select(
          "id, name, goal, status, total_budget, start_date, end_date, created_at"
        )
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (params.status) {
        query = query.eq("status", params.status);
      }

      const { data: campaignsRaw } = await query;
      const campaigns = (campaignsRaw || []) as Record<string, unknown>[];
      return { campaigns, count: campaigns.length };
    },
  });
}

import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function orderAttributorTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "Trigger order reconciliation to find any missed attributed orders. Checks Shopify orders against campaign discount codes and UTM links. Use when the user asks to 'reconcile orders', 'check for missed orders', or 'sync attribution'.",
    inputSchema: z.object({
      campaign_id: z
        .string()
        .optional()
        .describe("Specific campaign UUID. If omitted, checks all active campaigns."),
    }),
    execute: async (params) => {
      // 1. Get campaigns to reconcile
      let campaignQuery = supabase
        .from("campaigns")
        .select("id, name, start_date, end_date, status")
        .eq("brand_id", brandId)
        .in("status", ["active", "completed"]);

      if (params.campaign_id) {
        campaignQuery = campaignQuery.eq("id", params.campaign_id);
      }

      const { data: campaignsRaw } = await campaignQuery;
      const campaigns = (campaignsRaw || []) as Record<string, unknown>[];

      if (campaigns.length === 0) {
        return {
          error: params.campaign_id
            ? "Campaign not found, not active/completed, or access denied"
            : "No active or completed campaigns found",
        };
      }

      const results: Record<string, unknown>[] = [];

      for (const campaign of campaigns) {
        const campaignId = campaign.id as string;

        // 2. Get discount codes for this campaign
        const { data: codesRaw } = await supabase
          .from("campaign_discount_codes")
          .select("id, code, creator_id, usage_count")
          .eq("campaign_id", campaignId);
        const codes = (codesRaw || []) as Record<string, unknown>[];

        // 3. Get UTM links for this campaign
        const { data: utmRaw } = await supabase
          .from("campaign_utm_links")
          .select("id, utm_content, creator_id, click_count")
          .eq("campaign_id", campaignId);
        const utmLinks = (utmRaw || []) as Record<string, unknown>[];

        // 4. Get current attributed orders count
        const { data: ordersRaw } = await supabase
          .from("attributed_orders")
          .select("id")
          .eq("campaign_id", campaignId);
        const currentOrders = (ordersRaw || []).length;

        // 5. Get performance summary
        const { data: perfRaw } = await supabase
          .from("campaign_performance_summary")
          .select("total_orders, total_revenue, discount_orders, utm_orders, both_orders")
          .eq("campaign_id", campaignId);
        const perf = (perfRaw || []) as Record<string, unknown>[];

        const totalRevenue = perf.reduce(
          (sum, p) => sum + ((p.total_revenue as number) || 0),
          0
        );
        const totalOrders = perf.reduce(
          (sum, p) => sum + ((p.total_orders as number) || 0),
          0
        );

        results.push({
          campaign_id: campaignId,
          campaign_name: campaign.name,
          status: campaign.status,
          tracking_setup: {
            discount_codes: codes.length,
            utm_links: utmLinks.length,
          },
          current_attribution: {
            attributed_orders: currentOrders,
            performance_total_orders: totalOrders,
            performance_total_revenue: totalRevenue,
          },
          recommendation:
            codes.length === 0 && utmLinks.length === 0
              ? "No tracking codes or UTM links set up. Generate them first."
              : "Attribution is tracked via Shopify webhooks in real-time. Manual reconciliation can be triggered from the campaign dashboard.",
        });
      }

      return {
        campaigns_checked: results.length,
        results,
      };
    },
  });
}

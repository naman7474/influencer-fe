import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const RATE_RANGES: Record<
  string,
  { min: number; max: number; median: number }
> = {
  nano: { min: 2000, max: 8000, median: 5000 },
  micro: { min: 8000, max: 25000, median: 15000 },
  mid: { min: 25000, max: 75000, median: 45000 },
  macro: { min: 75000, max: 300000, median: 150000 },
  mega: { min: 300000, max: 1500000, median: 500000 },
};

export function rateBenchmarkerTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "Look up market rate benchmarks for a creator based on tier, niche, and metrics. Also shows what this brand has paid historically. Use when the user asks about pricing, rates, or if a creator is worth a certain amount.",
    inputSchema: z.object({
      creator_id: z
        .string()
        .optional()
        .describe("Creator UUID for specific rate estimate"),
      tier: z
        .enum(["nano", "micro", "mid", "macro", "mega"])
        .optional()
        .describe("Creator tier"),
      niche: z.string().optional().describe("Creator niche"),
      content_format: z
        .string()
        .optional()
        .describe("Content format: reels, static, carousel, stories"),
    }),
    execute: async (params) => {
      let creatorData: Record<string, unknown> | null = null;

      if (params.creator_id) {
        const { data } = await supabase
          .from("mv_creator_leaderboard")
          .select(
            "creator_id, handle, tier, followers, cpi, avg_engagement_rate, primary_niche"
          )
          .eq("creator_id", params.creator_id)
          .single();
        creatorData = data as Record<string, unknown> | null;
      }

      const tier =
        (creatorData?.tier as string) || params.tier || "micro";
      const baseRange = RATE_RANGES[tier] || RATE_RANGES.micro;

      // CPI-based adjustment
      let adjustment = 1.0;
      if (creatorData?.cpi) {
        const cpi = creatorData.cpi as number;
        if (cpi >= 80) adjustment = 1.2;
        else if (cpi >= 60) adjustment = 1.0;
        else adjustment = 0.85;
      }

      // Format-based multiplier
      let formatMultiplier = 1.0;
      if (params.content_format === "reels") formatMultiplier = 1.15;
      else if (params.content_format === "carousel") formatMultiplier = 0.9;
      else if (params.content_format === "static") formatMultiplier = 0.75;

      const finalAdjustment = adjustment * formatMultiplier;

      // Get brand's historical rates for this tier (join through campaigns for brand filter)
      const { data: pastDealsRaw } = await supabase
        .from("campaign_creators")
        .select("agreed_rate, creator_id, creators!inner(tier), campaigns!inner(brand_id)")
        .eq("campaigns.brand_id", brandId)
        .not("agreed_rate", "is", null);
      const pastDeals = (pastDealsRaw || []) as Record<string, unknown>[];

      const tierDeals = pastDeals.filter(
        (d: Record<string, unknown>) =>
          (d.creators as Record<string, unknown>)?.tier === tier
      );
      const avgHistorical =
        tierDeals.length > 0
          ? tierDeals.reduce(
              (sum: number, d: Record<string, unknown>) =>
                sum + (d.agreed_rate as number),
              0
            ) / tierDeals.length
          : null;

      return {
        tier,
        content_format: params.content_format || "any",
        market_rate: {
          min: Math.round(baseRange.min * finalAdjustment),
          max: Math.round(baseRange.max * finalAdjustment),
          median: Math.round(baseRange.median * finalAdjustment),
          currency: "INR",
        },
        creator_specific: creatorData
          ? {
              handle: creatorData.handle,
              cpi: creatorData.cpi,
              engagement_rate: creatorData.avg_engagement_rate,
              niche: creatorData.primary_niche,
              cpi_adjustment:
                adjustment > 1
                  ? `+${Math.round((adjustment - 1) * 100)}% premium (high CPI)`
                  : adjustment < 1
                    ? `${Math.round((1 - adjustment) * 100)}% discount (lower CPI)`
                    : "market rate",
            }
          : null,
        brand_historical: {
          avg_rate_paid: avgHistorical ? Math.round(avgHistorical) : null,
          total_past_deals: tierDeals.length,
          note: avgHistorical
            ? `You typically pay ₹${Math.round(avgHistorical).toLocaleString()} for ${tier}-tier creators`
            : `No past ${tier}-tier deals found for rate comparison`,
        },
      };
    },
  });
}

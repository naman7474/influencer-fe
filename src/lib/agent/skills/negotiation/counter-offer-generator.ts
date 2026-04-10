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

export function counterOfferGeneratorTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to generate a data-backed counter-offer. This tool queries real market rates and past deals from the database. Call it when the user asks to counter, negotiate rate, or make an offer.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
      creator_id: z.string().describe("Creator UUID"),
      creator_ask: z.number().describe("Amount the creator is asking (INR)"),
      brand_max: z
        .number()
        .optional()
        .describe("Maximum the brand is willing to pay (INR)"),
      content_format: z
        .string()
        .optional()
        .describe("Content type: reels, static, carousel, stories"),
    }),
    execute: async (params) => {
      // 1. Load creator data
      const { data: creatorRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select(
          "creator_id, handle, display_name, followers, tier, cpi, avg_engagement_rate, primary_niche"
        )
        .eq("creator_id", params.creator_id)
        .single();
      const creator = creatorRaw as Record<string, unknown> | null;

      if (!creator) return { error: "Creator not found" };

      // 2. Load campaign context
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select("id, name, total_budget")
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign) return { error: "Campaign not found or access denied" };

      // 3. Load campaign_creator record
      const { data: ccRaw } = await supabase
        .from("campaign_creators")
        .select("id, agreed_rate, negotiation_status")
        .eq("campaign_id", params.campaign_id)
        .eq("creator_id", params.creator_id)
        .single();
      const cc = ccRaw as Record<string, unknown> | null;

      // 4. Get market benchmark
      const tier = (creator.tier as string) || "micro";
      const baseRange = RATE_RANGES[tier] || RATE_RANGES.micro;

      // CPI-based adjustment
      const cpi = (creator.cpi as number) || 50;
      let cpiAdjustment = 1.0;
      if (cpi >= 80) cpiAdjustment = 1.2;
      else if (cpi >= 60) cpiAdjustment = 1.0;
      else cpiAdjustment = 0.85;

      // Format multiplier
      let formatMultiplier = 1.0;
      if (params.content_format === "reels") formatMultiplier = 1.15;
      else if (params.content_format === "carousel") formatMultiplier = 0.9;
      else if (params.content_format === "static") formatMultiplier = 0.75;

      const finalAdj = cpiAdjustment * formatMultiplier;
      const marketMedian = Math.round(baseRange.median * finalAdj);
      const marketMin = Math.round(baseRange.min * finalAdj);
      const marketMax = Math.round(baseRange.max * finalAdj);

      // 5. Get brand's historical rates for this tier (join through campaigns for brand filter)
      const { data: pastDealsRaw } = await supabase
        .from("campaign_creators")
        .select("agreed_rate, creators!inner(tier), campaigns!inner(brand_id)")
        .eq("campaigns.brand_id", brandId)
        .not("agreed_rate", "is", null);
      const pastDeals = (pastDealsRaw || []) as Record<string, unknown>[];
      const tierDeals = pastDeals.filter(
        (d) => (d.creators as Record<string, unknown>)?.tier === tier
      );
      const avgHistorical =
        tierDeals.length > 0
          ? tierDeals.reduce(
              (sum, d) => sum + ((d.agreed_rate as number) || 0),
              0
            ) / tierDeals.length
          : null;

      // 6. Calculate CPI percentile position
      const cpiPercentile =
        cpi >= 80 ? "top_20" : cpi >= 60 ? "above_average" : cpi >= 40 ? "average" : "below_average";

      // 7. Generate recommended counter
      const creatorAsk = params.creator_ask;
      const brandMax = params.brand_max ?? marketMax;

      let recommendedCounter: number;
      let justification: string;

      if (creatorAsk <= marketMedian) {
        // Great deal — accept or slight counter
        recommendedCounter = creatorAsk;
        justification = `Creator's ask of ₹${creatorAsk.toLocaleString("en-IN")} is at or below market median (₹${marketMedian.toLocaleString("en-IN")}). Recommend accepting to maintain goodwill.`;
      } else if (creatorAsk <= marketMax && cpi >= 70) {
        // Premium creator, fair ask — offer ~90% of ask
        recommendedCounter = Math.round(creatorAsk * 0.9);
        justification = `High-CPI creator (${cpi}) asking within market range. Counter at 90% of ask as a fair negotiation point.`;
      } else if (creatorAsk > marketMax) {
        // Above market — counter at market median + CPI bonus
        recommendedCounter = Math.min(
          Math.round(marketMedian * (1 + (cpi - 50) / 200)),
          brandMax
        );
        justification = `Ask of ₹${creatorAsk.toLocaleString("en-IN")} exceeds market max (₹${marketMax.toLocaleString("en-IN")}). Countering based on market median adjusted for CPI score.`;
      } else {
        // Within range, standard counter
        recommendedCounter = Math.round(
          (marketMedian + creatorAsk) / 2
        );
        justification = `Splitting the difference between market median and creator's ask.`;
      }

      // Ensure counter doesn't exceed brand max
      if (recommendedCounter > brandMax) {
        recommendedCounter = brandMax;
        justification += ` Capped at brand's maximum budget of ₹${brandMax.toLocaleString("en-IN")}.`;
      }

      // 8. Get existing negotiation rounds
      const { data: roundsRaw } = await supabase
        .from("negotiations")
        .select("round_number, brand_offer, creator_ask, action_taken")
        .eq("campaign_id", params.campaign_id)
        .eq("creator_id", params.creator_id)
        .order("round_number", { ascending: true });
      const rounds = (roundsRaw || []) as Record<string, unknown>[];
      const nextRound = rounds.length + 1;

      // 9. Insert negotiation record
      await supabase.from("negotiations").insert({
        campaign_id: params.campaign_id,
        campaign_creator_id: cc?.id || null,
        brand_id: brandId,
        creator_id: params.creator_id,
        round_number: nextRound,
        brand_offer: null,
        creator_ask: params.creator_ask,
        agent_recommended: recommendedCounter,
        market_median: marketMedian,
        creator_cpi_percentile: cpiPercentile,
        action_taken: "pending",
        counter_amount: recommendedCounter,
        justification,
        status: "active",
      } as never);

      // 10. Update campaign_creator negotiation status
      if (cc) {
        await supabase
          .from("campaign_creators")
          .update({ negotiation_status: "active" } as never)
          .eq("id", cc.id);
      }

      return {
        creator: {
          handle: creator.handle,
          tier,
          cpi,
          cpi_percentile: cpiPercentile,
          engagement_rate: creator.avg_engagement_rate,
          followers: creator.followers,
        },
        negotiation: {
          round: nextRound,
          creator_ask: params.creator_ask,
          recommended_counter: recommendedCounter,
          savings_vs_ask:
            creatorAsk - recommendedCounter > 0
              ? creatorAsk - recommendedCounter
              : 0,
          justification,
          previous_rounds: rounds,
        },
        market_context: {
          market_min: marketMin,
          market_median: marketMedian,
          market_max: marketMax,
          brand_historical_avg: avgHistorical
            ? Math.round(avgHistorical)
            : null,
          ask_vs_median_percent: Math.round(
            ((creatorAsk - marketMedian) / marketMedian) * 100
          ),
        },
        actions: {
          use_recommended: `Counter with ₹${recommendedCounter.toLocaleString("en-IN")}`,
          accept_ask: `Accept creator's ask of ₹${creatorAsk.toLocaleString("en-IN")}`,
          custom: "Enter your own counter amount",
        },
      };
    },
  });
}

import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function relationshipScorerTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to compute a relationship health score from real database data. Never invent relationship scores. Call it when the user asks about relationship health, creator loyalty, or how a relationship is going.",
    inputSchema: z.object({
      creator_id: z.string().describe("Creator UUID"),
    }),
    execute: async (params) => {
      // 1. Load relationship summary from materialized view
      const { data: relRaw } = await supabase
        .from("mv_creator_relationship_summary")
        .select("*")
        .eq("creator_id", params.creator_id)
        .eq("brand_id", brandId)
        .single();
      const rel = relRaw as Record<string, unknown> | null;

      // 2. Load creator profile
      const { data: creatorRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select("creator_id, handle, display_name, tier, followers, cpi")
        .eq("creator_id", params.creator_id)
        .single();
      const creator = creatorRaw as Record<string, unknown> | null;

      if (!creator) return { error: "Creator not found" };

      if (!rel) {
        return {
          creator: {
            handle: creator.handle,
            display_name: creator.display_name,
            tier: creator.tier,
          },
          relationship_score: 0,
          status: "no_history",
          message: "No campaign history with this creator yet.",
        };
      }

      // 3. Compute health score (0-100)
      const totalCampaigns = (rel.total_campaigns as number) || 0;
      const totalSpend = (rel.total_spend as number) || 0;
      const totalRevenue = (rel.total_revenue as number) || 0;
      const replyCount = (rel.reply_count as number) || 0;
      const lifetimeRoi = (rel.lifetime_roi as number) || 0;
      const lastCompleted = rel.last_campaign_completed as string | null;

      // Loyalty: more campaigns = higher score (cap at 5)
      const loyaltyScore = Math.min(totalCampaigns / 5, 1) * 25;

      // ROI performance
      const roiScore =
        lifetimeRoi >= 3 ? 30 : lifetimeRoi >= 2 ? 25 : lifetimeRoi >= 1 ? 15 : 5;

      // Responsiveness (based on reply count relative to campaigns)
      const responseScore =
        totalCampaigns > 0
          ? Math.min((replyCount / totalCampaigns) * 15, 20)
          : 0;

      // Recency (how recently they completed a campaign)
      let recencyScore = 0;
      if (lastCompleted) {
        const daysSince = Math.floor(
          (Date.now() - new Date(lastCompleted).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince < 30) recencyScore = 25;
        else if (daysSince < 60) recencyScore = 20;
        else if (daysSince < 90) recencyScore = 15;
        else if (daysSince < 180) recencyScore = 10;
        else recencyScore = 5;
      }

      const totalScore = Math.round(
        loyaltyScore + roiScore + responseScore + recencyScore
      );

      // 4. Determine status label
      let status: string;
      if (totalScore >= 80) status = "excellent";
      else if (totalScore >= 60) status = "strong";
      else if (totalScore >= 40) status = "developing";
      else if (totalScore >= 20) status = "at_risk";
      else status = "cold";

      return {
        creator: {
          handle: creator.handle,
          display_name: creator.display_name,
          tier: creator.tier,
          followers: creator.followers,
          cpi: creator.cpi,
        },
        relationship_score: totalScore,
        status,
        breakdown: {
          loyalty: Math.round(loyaltyScore),
          roi_performance: roiScore,
          responsiveness: Math.round(responseScore),
          recency: recencyScore,
        },
        history: {
          total_campaigns: totalCampaigns,
          total_spend: totalSpend,
          total_revenue: totalRevenue,
          lifetime_roi: lifetimeRoi,
          last_campaign: lastCompleted,
        },
      };
    },
  });
}

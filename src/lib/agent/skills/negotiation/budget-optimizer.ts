import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const TIER_MEDIAN_RATES: Record<string, number> = {
  nano: 5000,
  micro: 15000,
  mid: 45000,
  macro: 150000,
  mega: 500000,
};

export function budgetOptimizerTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "Analyze campaign budget utilization and provide optimization insights. Shows available budget, confirmed spend, negotiation headroom, and warning flags. Use when the user asks about 'budget', 'how much is left', 'can we afford', or 'budget optimization'.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
    }),
    execute: async (params) => {
      // 1. Load campaign
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select("id, name, budget, status")
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign) return { error: "Campaign not found or access denied" };

      const totalBudget = (campaign.budget as number) || 0;
      if (totalBudget === 0) {
        return {
          campaign: campaign.name,
          error:
            "No budget set for this campaign. Set a budget in campaign settings first.",
        };
      }

      // 2. Get all campaign creators with their rates and statuses
      const { data: creatorsRaw } = await supabase
        .from("campaign_creators")
        .select(
          "id, creator_id, status, agreed_rate, negotiation_status, creators:creator_id(handle, tier)"
        )
        .eq("campaign_id", params.campaign_id);
      const creators = (creatorsRaw || []) as Record<string, unknown>[];

      // 3. Calculate spend buckets
      let confirmedSpend = 0;
      let negotiatingSpend = 0;
      const shortlisted: { handle: string; tier: string }[] = [];
      const negotiating: {
        handle: string;
        tier: string;
        current_ask: number | null;
      }[] = [];

      for (const c of creators) {
        const creator = c.creators as Record<string, unknown> | null;
        const handle = (creator?.handle as string) || "unknown";
        const tier = (creator?.tier as string) || "micro";
        const agreedRate = c.agreed_rate as number | null;
        const status = c.status as string;
        const negStatus = c.negotiation_status as string | null;

        if (
          status === "confirmed" &&
          agreedRate &&
          negStatus !== "negotiating"
        ) {
          confirmedSpend += agreedRate;
        } else if (negStatus === "negotiating" || status === "negotiating") {
          negotiatingSpend += agreedRate || 0;
          negotiating.push({
            handle,
            tier,
            current_ask: agreedRate,
          });
        } else if (
          status === "shortlisted" ||
          status === "contacted" ||
          status === "interested"
        ) {
          shortlisted.push({ handle, tier });
        }
      }

      // 4. Estimate reserve for shortlisted (using tier medians)
      const reservedForShortlisted = shortlisted.reduce((sum, c) => {
        return sum + (TIER_MEDIAN_RATES[c.tier] || TIER_MEDIAN_RATES.micro);
      }, 0);

      // 5. Calculate available
      const available = totalBudget - confirmedSpend;
      const negotiationPool =
        available - reservedForShortlisted - negotiatingSpend;
      const maxPerCreator =
        negotiating.length > 0
          ? Math.round(negotiationPool / negotiating.length)
          : negotiationPool;

      // 6. Warning flags
      const warnings: string[] = [];
      const budgetUsedPercent = Math.round(
        (confirmedSpend / totalBudget) * 100
      );

      if (budgetUsedPercent > 90) {
        warnings.push(
          `⚠ ${budgetUsedPercent}% of budget already committed. Very limited room for new deals.`
        );
      }

      if (negotiating.length > 0) {
        const singleCreatorMax = available * 0.3;
        for (const n of negotiating) {
          if (n.current_ask && n.current_ask > singleCreatorMax) {
            warnings.push(
              `⚠ ${n.handle}'s ask (₹${n.current_ask.toLocaleString("en-IN")}) exceeds 30% of remaining budget.`
            );
          }
        }
      }

      // Check if avg deals are above market median
      const confirmedCreators = creators.filter(
        (c) =>
          (c.status as string) === "confirmed" &&
          (c.agreed_rate as number) > 0
      );
      if (confirmedCreators.length > 0) {
        const avgRate =
          confirmedCreators.reduce(
            (sum, c) => sum + ((c.agreed_rate as number) || 0),
            0
          ) / confirmedCreators.length;
        const tiers = confirmedCreators.map(
          (c) =>
            ((c.creators as Record<string, unknown>)?.tier as string) ||
            "micro"
        );
        const avgMedian =
          tiers.reduce(
            (sum, t) => sum + (TIER_MEDIAN_RATES[t] || 15000),
            0
          ) / tiers.length;
        if (avgRate > avgMedian * 1.2) {
          warnings.push(
            `⚠ Average confirmed rate (₹${Math.round(avgRate).toLocaleString("en-IN")}) is 20%+ above market median.`
          );
        }
      }

      return {
        campaign: campaign.name,
        budget_summary: {
          total_budget: totalBudget,
          confirmed_spend: confirmedSpend,
          negotiating_spend: negotiatingSpend,
          reserved_for_shortlisted: reservedForShortlisted,
          available_for_negotiation: Math.max(0, negotiationPool),
          max_per_active_negotiation:
            negotiating.length > 0 ? Math.max(0, maxPerCreator) : null,
          budget_used_percent: budgetUsedPercent,
        },
        creator_breakdown: {
          confirmed: confirmedCreators.length,
          negotiating: negotiating.length,
          shortlisted: shortlisted.length,
          total: creators.length,
        },
        active_negotiations: negotiating,
        warnings: warnings.length > 0 ? warnings : null,
        recommendation:
          negotiationPool < 0
            ? "Budget is over-committed. Consider reducing shortlist or renegotiating existing deals."
            : budgetUsedPercent > 75
              ? "Budget is getting tight. Prioritize top-performing creator profiles."
              : "Budget is healthy. Proceed with negotiations.",
      };
    },
  });
}

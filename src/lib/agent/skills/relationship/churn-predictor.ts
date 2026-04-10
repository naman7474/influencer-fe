import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function churnPredictorTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "Predict which creators are at risk of churning (declining engagement, longer response times, fewer campaigns). Use when the user asks about 'churn risk', 'who might leave', 'declining creators', or 'at-risk relationships'.",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Max results"),
    }),
    execute: async (params) => {
      // 1. Get all relationship summaries
      const { data: relsRaw } = await supabase
        .from("mv_creator_relationship_summary")
        .select("*")
        .eq("brand_id", brandId)
        .gte("total_campaigns", 1)
        .order("last_campaign_completed", { ascending: true });
      const rels = (relsRaw || []) as Record<string, unknown>[];

      if (rels.length === 0) {
        return {
          results: [],
          count: 0,
          message: "No creator relationships found to analyze.",
        };
      }

      // 2. Score churn risk for each creator
      const scored = rels.map((r) => {
        const totalCampaigns = (r.total_campaigns as number) || 0;
        const lifetimeRoi = (r.lifetime_roi as number) || 0;
        const lastCompleted = r.last_campaign_completed as string | null;
        const replyCount = (r.reply_count as number) || 0;

        let churnScore = 0;
        const signals: string[] = [];

        // Inactivity signal
        if (lastCompleted) {
          const daysSince = Math.floor(
            (Date.now() - new Date(lastCompleted).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          if (daysSince > 180) {
            churnScore += 35;
            signals.push(`Inactive for ${daysSince} days`);
          } else if (daysSince > 90) {
            churnScore += 20;
            signals.push(`${daysSince} days since last campaign`);
          }
        }

        // Declining ROI signal
        if (lifetimeRoi < 1 && totalCampaigns >= 2) {
          churnScore += 25;
          signals.push(`Low lifetime ROI (${lifetimeRoi.toFixed(1)}x)`);
        } else if (lifetimeRoi < 1.5 && totalCampaigns >= 3) {
          churnScore += 15;
          signals.push(`Below-average ROI (${lifetimeRoi.toFixed(1)}x)`);
        }

        // Low responsiveness
        if (totalCampaigns > 0 && replyCount / totalCampaigns < 0.5) {
          churnScore += 20;
          signals.push("Low response rate");
        }

        // Single campaign creators who performed poorly
        if (totalCampaigns === 1 && lifetimeRoi < 1) {
          churnScore += 15;
          signals.push("Single campaign with poor results");
        }

        return {
          ...(r as Record<string, unknown>),
          churn_score: Math.min(churnScore, 100),
          signals,
        } as Record<string, unknown>;
      });

      // 3. Filter to at-risk (score > 20) and sort by churn score desc
      const atRisk = scored
        .filter((r) => (r.churn_score as number) > 20)
        .sort((a, b) => (b.churn_score as number) - (a.churn_score as number))
        .slice(0, params.limit ?? 10);

      if (atRisk.length === 0) {
        return {
          results: [],
          count: 0,
          message:
            "No creators are currently at high churn risk. All relationships are healthy.",
        };
      }

      // 4. Load creator profiles
      const creatorIds = atRisk.map((r) => r.creator_id as string);
      const { data: creatorsRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select("creator_id, handle, display_name, tier, followers, cpi")
        .in("creator_id", creatorIds);
      const creators = (creatorsRaw || []) as Record<string, unknown>[];
      const creatorMap = new Map(
        creators.map((c) => [c.creator_id as string, c])
      );

      const results = atRisk.map((r) => {
        const creator = creatorMap.get(r.creator_id as string);

        return {
          creator_id: r.creator_id,
          handle: creator?.handle ?? r.creator_id,
          display_name: creator?.display_name,
          tier: creator?.tier,
          followers: creator?.followers,
          churn_risk: {
            score: r.churn_score as number,
            level:
              (r.churn_score as number) >= 60
                ? "high"
                : (r.churn_score as number) >= 40
                  ? "medium"
                  : "low",
            signals: r.signals as string[],
          },
          relationship: {
            total_campaigns: r.total_campaigns,
            lifetime_roi: r.lifetime_roi,
            last_campaign: r.last_campaign_completed,
            total_spend: r.total_spend,
          },
          recommendation:
            (r.churn_score as number) >= 60
              ? "Urgent re-engagement needed. Consider a personalized outreach or special offer."
              : "Monitor closely. Schedule a check-in message.",
        };
      });

      return {
        results,
        count: results.length,
        risk_distribution: {
          high: results.filter((r) => r.churn_risk.level === "high").length,
          medium: results.filter((r) => r.churn_risk.level === "medium").length,
          low: results.filter((r) => r.churn_risk.level === "low").length,
        },
      };
    },
  });
}

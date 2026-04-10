import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function campaignReporterTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "CALL THIS TOOL to generate a campaign report from real data. This tool queries the database and stores the report. Call it when the user asks for a campaign report, performance summary, or final report.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
      report_type: z
        .enum(["interim", "final"])
        .optional()
        .default("interim")
        .describe("Report type: interim (during campaign) or final (after completion)"),
    }),
    execute: async (params) => {
      // 1. Load campaign
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select("id, name, goal, total_budget, start_date, end_date, status, default_discount_percentage")
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

      // 3. Get creator details
      const creatorIds = perf.map((p) => p.creator_id as string);
      let creators: Record<string, unknown>[] = [];
      if (creatorIds.length > 0) {
        const { data: creatorsRaw } = await supabase
          .from("mv_creator_leaderboard")
          .select("creator_id, handle, display_name, tier, followers, avg_engagement_rate")
          .in("creator_id", creatorIds);
        creators = (creatorsRaw || []) as Record<string, unknown>[];
      }
      const creatorMap = new Map(creators.map((c) => [c.creator_id as string, c]));

      // 4. Get campaign creators for status info
      const { data: ccRaw } = await supabase
        .from("campaign_creators")
        .select("creator_id, status, agreed_rate, content_status")
        .eq("campaign_id", params.campaign_id);
      const campaignCreators = (ccRaw || []) as Record<string, unknown>[];

      // 5. Aggregate executive summary
      let totalSpend = 0;
      let totalRevenue = 0;
      let totalOrders = 0;

      const perCreatorBreakdown = perf.map((p) => {
        const creator = creatorMap.get(p.creator_id as string);
        const cc = campaignCreators.find(
          (c) => c.creator_id === p.creator_id
        );
        const spend = (p.creator_cost as number) || 0;
        const revenue = (p.total_revenue as number) || 0;
        const orders = (p.total_orders as number) || 0;

        totalSpend += spend;
        totalRevenue += revenue;
        totalOrders += orders;

        return {
          creator_id: p.creator_id,
          handle: creator?.handle ?? p.creator_id,
          tier: creator?.tier,
          followers: creator?.followers,
          spend,
          revenue,
          orders,
          roi: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0,
          content_status: cc?.content_status ?? "unknown",
          campaign_status: cc?.status ?? "unknown",
        };
      });

      perCreatorBreakdown.sort((a, b) => b.roi - a.roi);

      const executiveSummary = {
        campaign_name: campaign.name,
        campaign_goal: campaign.goal,
        campaign_status: campaign.status,
        dates: { start: campaign.start_date, end: campaign.end_date },
        budget: campaign.total_budget,
        total_spend: totalSpend,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        overall_roi:
          totalSpend > 0
            ? Math.round((totalRevenue / totalSpend) * 100) / 100
            : 0,
        budget_utilization: campaign.total_budget
          ? Math.round((totalSpend / (campaign.total_budget as number)) * 100)
          : null,
        creators_count: campaignCreators.length,
        confirmed_creators: campaignCreators.filter(
          (c) => c.status === "confirmed"
        ).length,
      };

      // 6. Get geographic impact if snapshots exist
      const { data: geoRaw } = await supabase
        .from("campaign_geo_snapshots")
        .select("city, state, snapshot_type, sessions, orders, revenue, session_lift_percent, order_lift_percent, revenue_lift_percent")
        .eq("campaign_id", params.campaign_id)
        .eq("snapshot_type", "post_campaign")
        .order("revenue_lift_percent", { ascending: false })
        .limit(10);
      const geoImpact = (geoRaw || []) as Record<string, unknown>[];

      // 7. Get content submissions summary
      const { data: contentRaw } = await supabase
        .from("content_submissions")
        .select("id, creator_id, status, content_url, submitted_at")
        .eq("campaign_id", params.campaign_id)
        .order("submitted_at", { ascending: false });
      const contentSubmissions = (contentRaw || []) as Record<string, unknown>[];

      // 8. Recommendations
      const recommendations = generateRecommendations(
        executiveSummary,
        perCreatorBreakdown,
        campaignCreators
      );

      // 9. Store report
      const reportData = {
        campaign_id: params.campaign_id,
        brand_id: brandId,
        report_type: params.report_type ?? "interim",
        executive_summary: executiveSummary,
        per_creator_breakdown: perCreatorBreakdown,
        geographic_impact: geoImpact.length > 0 ? geoImpact : null,
        top_content_analysis: contentSubmissions.slice(0, 5),
        recommendations,
      };

      await supabase
        .from("campaign_reports")
        .upsert(reportData, {
          onConflict: "campaign_id,report_type",
        });

      return {
        report_type: params.report_type,
        executive_summary: executiveSummary,
        per_creator_breakdown: perCreatorBreakdown,
        geographic_impact:
          geoImpact.length > 0
            ? geoImpact.map((g) => ({
                city: g.city,
                state: g.state,
                session_lift: g.session_lift_percent,
                order_lift: g.order_lift_percent,
                revenue_lift: g.revenue_lift_percent,
              }))
            : null,
        content_summary: {
          total_submissions: contentSubmissions.length,
          approved: contentSubmissions.filter(
            (c) => c.status === "approved"
          ).length,
          pending_review: contentSubmissions.filter(
            (c) => c.status === "submitted"
          ).length,
        },
        recommendations,
      };
    },
  });
}

function generateRecommendations(
  summary: Record<string, unknown>,
  perCreator: Record<string, unknown>[],
  campaignCreators: Record<string, unknown>[]
): Record<string, unknown> {
  const rebook: string[] = [];
  const phaseOut: string[] = [];
  const ambassadorCandidates: string[] = [];

  for (const c of perCreator) {
    const roi = (c.roi as number) || 0;
    const orders = (c.orders as number) || 0;
    const spend = (c.spend as number) || 0;
    const handle = (c.handle as string) || "unknown";
    if (roi >= 3 && orders >= 5) {
      rebook.push(handle);
      if (roi >= 5) ambassadorCandidates.push(handle);
    } else if (roi < 1 && spend > 0) {
      phaseOut.push(handle);
    }
  }

  return {
    rebook_creators: rebook,
    ambassador_candidates: ambassadorCandidates,
    phase_out_creators: phaseOut,
    overall:
      (summary.overall_roi as number) >= 2
        ? "Strong campaign performance. Consider scaling budget and rebooking top creators."
        : (summary.overall_roi as number) >= 1
          ? "Campaign is breaking even. Focus on top performers and reconsider low-ROI creators."
          : "Campaign is under-performing. Review creator selection and content strategy.",
  };
}

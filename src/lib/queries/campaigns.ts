import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCampaignsOverview(
  supabase: SupabaseClient,
  brandId: string
) {
  const campaignsRes = await supabase
    .from("campaigns")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });

  if (campaignsRes.error) throw campaignsRes.error;

  const campaigns = campaignsRes.data ?? [];
  const campaignIds = campaigns.map((campaign) => campaign.id);

  const [campaignCreatorsRes, performanceRes] = await Promise.all([
    campaignIds.length > 0
      ? supabase
          .from("campaign_creators")
          .select("campaign_id, status")
          .in("campaign_id", campaignIds)
      : Promise.resolve({ data: [], error: null }),
    campaignIds.length > 0
      ? supabase
          .from("campaign_performance")
          .select("campaign_id, roi_ratio, campaign_sessions, campaign_orders")
          .in("campaign_id", campaignIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (campaignCreatorsRes.error) throw campaignCreatorsRes.error;
  if (performanceRes.error) throw performanceRes.error;

  const statusByCampaign = new Map<string, Record<string, number>>();
  for (const row of campaignCreatorsRes.data ?? []) {
    const current = statusByCampaign.get(row.campaign_id) ?? {};
    current[row.status] = (current[row.status] ?? 0) + 1;
    statusByCampaign.set(row.campaign_id, current);
  }

  const performanceByCampaign = new Map<
    string,
    { roi: number; sessions: number; orders: number }
  >();
  for (const row of performanceRes.data ?? []) {
    performanceByCampaign.set(row.campaign_id, {
      roi: Number(row.roi_ratio ?? 0),
      sessions: Number(row.campaign_sessions ?? 0),
      orders: Number(row.campaign_orders ?? 0),
    });
  }

  const creatorsInPipeline = (campaignCreatorsRes.data ?? []).length;
  const projectedRoi =
    performanceRes.data && performanceRes.data.length > 0
      ? performanceRes.data.reduce((sum, row) => sum + Number(row.roi_ratio ?? 0), 0) /
        performanceRes.data.length
      : null;

  return {
    summary: {
      activeCampaigns: campaigns.length,
      creatorsInPipeline,
      projectedRoi,
      completionRate:
        creatorsInPipeline > 0
          ? Math.round(
              ((campaignCreatorsRes.data ?? []).filter(
                (row) => row.status === "completed"
              ).length /
                creatorsInPipeline) *
                100
            )
          : 0,
    },
    campaigns: campaigns.map((campaign) => {
      const split = statusByCampaign.get(campaign.id) ?? {};
      const performance = performanceByCampaign.get(campaign.id);
      return {
        ...campaign,
        creators: Object.values(split).reduce((sum, value) => sum + value, 0),
        roi: Math.round((performance?.roi ?? 0) * 100) / 100,
        split: [
          { label: "Shortlisted", value: split.shortlisted ?? 0, color: "#f59e0b" },
          { label: "Contacted", value: split.contacted ?? 0, color: "#f97316" },
          { label: "Confirmed", value: split.confirmed ?? 0, color: "#0f766e" },
          { label: "Completed", value: split.completed ?? 0, color: "#1d4ed8" },
        ],
      };
    }),
  };
}

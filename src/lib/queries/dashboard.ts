import type { SupabaseClient } from "@supabase/supabase-js";

type DashboardRecentOutreachItem = {
  id: string;
  status: string;
  channel: string;
  created_at: string;
  campaign: {
    id: string;
    name: string;
  } | null;
  creator: {
    handle: string | null;
    display_name: string | null;
  } | null;
};

export async function getDashboardOverview(
  supabase: SupabaseClient,
  brandId: string
) {
  const campaignIdsRes = await supabase
    .from("campaigns")
    .select("id")
    .eq("brand_id", brandId);

  if (campaignIdsRes.error) throw campaignIdsRes.error;
  const campaignIds = campaignIdsRes.data?.map((campaign) => campaign.id) ?? [];

  const [
    campaignsRes,
    campaignCreatorsRes,
    campaignPerformanceRes,
    topGeoRes,
    geoAlertsRes,
    matchesRes,
    shortlistRes,
    outreachRes,
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(6),
    campaignIds.length > 0
      ? supabase
          .from("campaign_creators")
          .select("campaign_id, status")
          .in("campaign_id", campaignIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("campaign_performance").select("roi_ratio").eq("brand_id", brandId),
    supabase
      .from("brand_shopify_geo")
      .select("id, city, state, problem_type, gap_score")
      .eq("brand_id", brandId)
      .order("gap_score", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("brand_shopify_geo")
      .select("city, state, problem_type, gap_score, sessions, orders")
      .eq("brand_id", brandId)
      .order("gap_score", { ascending: false })
      .limit(3),
    supabase
      .from("creator_brand_matches")
      .select("creator_id, match_score, match_reasoning, recommended_for")
      .eq("brand_id", brandId)
      .order("match_score", { ascending: false })
      .limit(6),
    supabase
      .from("brand_shortlist_items")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId),
    supabase
      .from("outreach_messages")
      .select(
        "id, status, channel, created_at, campaign:campaigns(id, name), creator:creators(handle, display_name)"
      )
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (campaignsRes.error) throw campaignsRes.error;
  if (campaignCreatorsRes.error) throw campaignCreatorsRes.error;
  if (campaignPerformanceRes.error) throw campaignPerformanceRes.error;
  if (topGeoRes.error) throw topGeoRes.error;
  if (geoAlertsRes.error) throw geoAlertsRes.error;
  if (matchesRes.error) throw matchesRes.error;
  if (shortlistRes.error) throw shortlistRes.error;
  if (outreachRes.error) throw outreachRes.error;

  const campaigns = campaignsRes.data ?? [];
  const campaignCreators = campaignCreatorsRes.data ?? [];
  const roiRows = campaignPerformanceRes.data ?? [];
  const topMatchRows = matchesRes.data ?? [];

  const creatorIds = topMatchRows.map((row) => row.creator_id);
  const creatorsRes =
    creatorIds.length > 0
      ? await supabase
          .from("mv_creator_leaderboard")
          .select(
            "creator_id, handle, display_name, avatar_url, primary_niche, primary_tone, cpi, is_verified, engagement_trend, audience_country"
          )
          .in("creator_id", creatorIds)
      : { data: [], error: null };

  if (creatorsRes.error) throw creatorsRes.error;

  const creatorMap = new Map(
    (creatorsRes.data ?? []).map((creator) => [creator.creator_id, creator])
  );
  const recentOutreach: DashboardRecentOutreachItem[] = (outreachRes.data ?? []).map(
    (row) => ({
      id: row.id,
      status: row.status,
      channel: row.channel,
      created_at: row.created_at,
      campaign: Array.isArray(row.campaign)
        ? (row.campaign[0] ?? null)
        : (row.campaign ?? null),
      creator: Array.isArray(row.creator)
        ? (row.creator[0] ?? null)
        : (row.creator ?? null),
    })
  );

  const campaignStatusMap = new Map<
    string,
    Record<string, number>
  >();
  for (const row of campaignCreators) {
    const statusMap = campaignStatusMap.get(row.campaign_id) ?? {};
    statusMap[row.status] = (statusMap[row.status] ?? 0) + 1;
    campaignStatusMap.set(row.campaign_id, statusMap);
  }

  const avgCampaignRoi =
    roiRows.length > 0
      ? roiRows.reduce((sum, row) => sum + Number(row.roi_ratio ?? 0), 0) /
        roiRows.length
      : null;

  return {
    summary: {
      active_campaigns: campaigns.length,
      creators_in_pipeline: campaignCreators.length,
      avg_campaign_roi: avgCampaignRoi,
      top_geo_opportunity: topGeoRes.data
        ? {
            region_id: topGeoRes.data.id,
            region_name:
              [topGeoRes.data.city, topGeoRes.data.state].filter(Boolean).join(", ") ||
              "Unknown region",
            problem_type: topGeoRes.data.problem_type,
            gap_score: Number(topGeoRes.data.gap_score ?? 0) * 100,
          }
        : null,
    },
    active_campaigns: campaigns.map((campaign) => {
      const split = campaignStatusMap.get(campaign.id) ?? {};
      return {
        campaign_id: campaign.id,
        name: campaign.name,
        goal: campaign.goal,
        status: campaign.status,
        creators: Object.values(split).reduce((sum, value) => sum + value, 0),
        split: [
          { label: "Shortlisted", value: split.shortlisted ?? 0, color: "#f59e0b" },
          { label: "Contacted", value: split.contacted ?? 0, color: "#f97316" },
          { label: "Confirmed", value: split.confirmed ?? 0, color: "#0f766e" },
          { label: "Completed", value: split.completed ?? 0, color: "#1d4ed8" },
        ],
      };
    }),
    geo_alerts: (geoAlertsRes.data ?? []).map((row) => ({
      region: [row.city, row.state].filter(Boolean).join(", ") || "Unknown region",
      type: row.problem_type,
      note: `Sessions ${row.sessions ?? 0}, orders ${row.orders ?? 0}, gap score ${Math.round(
        Number(row.gap_score ?? 0) * 100
      )}.`,
      tone:
        row.problem_type === "awareness_gap"
          ? "bg-rose-100 text-rose-800"
          : row.problem_type === "conversion_gap"
            ? "bg-amber-100 text-amber-800"
            : "bg-emerald-100 text-emerald-800",
    })),
    top_matches: (matchesRes.data ?? []).map((row) => ({
      creator_id: row.creator_id,
      match_score: row.match_score,
      match_reasoning: row.match_reasoning,
      recommended_for: row.recommended_for,
      creator: creatorMap.get(row.creator_id) ?? null,
    })),
    shortlist_count: shortlistRes.count ?? 0,
    recent_outreach: recentOutreach,
  };
}

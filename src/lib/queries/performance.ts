import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCampaignPerformance(
  supabase: SupabaseClient,
  brandId: string,
  campaignId: string
) {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, name, total_orders_attributed, total_revenue_attributed, total_creator_cost, overall_roi, last_attribution_at"
    )
    .eq("brand_id", brandId)
    .eq("id", campaignId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getCampaignCreatorPerformance(
  supabase: SupabaseClient,
  brandId: string,
  campaignId: string
) {
  const { data, error } = await supabase
    .from("campaign_performance")
    .select(
      "*, campaign_creator:campaign_creators(id, creator_id, agreed_rate, creator:creators(id, handle, display_name, avatar_url))"
    )
    .eq("brand_id", brandId)
    .eq("campaign_id", campaignId)
    .is("region", null)
    .order("revenue_attributed", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getCampaignRegionalPerformance(
  supabase: SupabaseClient,
  brandId: string,
  campaignId: string
) {
  const { data, error } = await supabase
    .from("campaign_performance")
    .select("region, baseline_orders, campaign_orders, baseline_revenue, campaign_revenue")
    .eq("brand_id", brandId)
    .eq("campaign_id", campaignId)
    .not("region", "is", null)
    .order("campaign_revenue", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getCampaignPerformanceTimeSeries(
  supabase: SupabaseClient,
  brandId: string,
  campaignId: string
) {
  const { data, error } = await supabase
    .from("campaign_performance_snapshots")
    .select("*")
    .eq("brand_id", brandId)
    .eq("campaign_id", campaignId)
    .order("snapshot_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

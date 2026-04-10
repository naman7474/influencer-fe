/* ------------------------------------------------------------------ */
/*  Shared database queries for agent skills                           */
/*  Every function takes brandId + supabase and filters appropriately  */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Load a creator from the leaderboard view with scores.
 */
export async function getCreatorWithScores(
  creatorId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("mv_creator_leaderboard")
    .select("*")
    .eq("creator_id", creatorId)
    .single();
  return data as Record<string, unknown> | null;
}

/**
 * Load a creator's full record (contact email, bio, etc.)
 */
export async function getCreatorFull(
  creatorId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("creators")
    .select("contact_email, display_name, biography, external_url")
    .eq("id", creatorId)
    .single();
  return data as Record<string, unknown> | null;
}

/**
 * Load brand profile with all context fields.
 */
export async function getBrandWithContext(
  brandId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();
  return data as Record<string, unknown> | null;
}

/**
 * Load a campaign with its assigned creators.
 */
export async function getCampaignWithCreators(
  campaignId: string,
  brandId: string,
  supabase: SupabaseClient
): Promise<{
  campaign: Record<string, unknown> | null;
  creators: Record<string, unknown>[];
}> {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("brand_id", brandId)
    .single();

  const { data: creators } = await supabase
    .from("campaign_creators")
    .select(
      "id, creator_id, status, agreed_rate, match_score_at_assignment, content_status, negotiation_status, creators(handle, display_name, followers, tier)"
    )
    .eq("campaign_id", campaignId);

  return {
    campaign: campaign as Record<string, unknown> | null,
    creators: (creators || []) as Record<string, unknown>[],
  };
}

/**
 * Load campaign performance summary for a campaign.
 */
export async function getPerformanceSummary(
  campaignId: string,
  brandId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from("campaign_performance_summary")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("brand_id", brandId);
  return (data || []) as Record<string, unknown>[];
}

/**
 * Get brand-specific match data for a creator.
 */
export async function getCreatorBrandMatch(
  creatorId: string,
  brandId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("creator_brand_matches")
    .select("*")
    .eq("brand_id", brandId)
    .eq("creator_id", creatorId)
    .single();
  return data as Record<string, unknown> | null;
}

/**
 * Get caption intelligence for a creator (most recent).
 */
export async function getCreatorCaptionIntelligence(
  creatorId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("caption_intelligence")
    .select(
      "primary_niche, primary_tone, organic_brand_mentions, paid_brand_mentions"
    )
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data as Record<string, unknown> | null;
}

/**
 * Get collaboration history between a creator and a brand.
 */
export async function getCollaborationHistory(
  creatorId: string,
  brandId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from("campaign_creators")
    .select(
      "campaign_id, status, agreed_rate, campaigns!inner(name, goal, status, brand_id)"
    )
    .eq("creator_id", creatorId)
    .eq("campaigns.brand_id", brandId);
  return (data || []) as Record<string, unknown>[];
}

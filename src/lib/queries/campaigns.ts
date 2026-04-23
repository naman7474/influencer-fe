import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Campaign,
  CampaignInsert,
  CampaignUpdate,
} from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CampaignCreatorWithDetails {
  id: string;
  campaign_id: string;
  creator_id: string;
  status: string;
  match_score_at_assignment: number | null;
  agreed_rate: number | null;
  content_deliverables: string[] | null;
  posts_delivered: number | null;
  assigned_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  creator: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    followers: number | null;
    tier: string | null;
    is_verified: boolean | null;
    city: string | null;
    country: string | null;
  };
}

export interface CampaignWithCreators extends Campaign {
  creators: CampaignCreatorWithDetails[];
}

/* ------------------------------------------------------------------ */
/*  Get campaigns for a brand                                          */
/* ------------------------------------------------------------------ */

export async function getCampaigns(
  supabase: SupabaseClient<Database>,
  brandId: string,
  statusFilter?: string,
): Promise<Campaign[]> {
  let query = supabase
    .from("campaigns")
    .select("*")
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getCampaigns error:", error);
    return [];
  }

  return data ?? [];
}

/* ------------------------------------------------------------------ */
/*  Get a single campaign with creators                                */
/* ------------------------------------------------------------------ */

export async function getCampaign(
  supabase: SupabaseClient<Database>,
  campaignId: string,
): Promise<CampaignWithCreators | null> {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) {
    console.error("getCampaign error:", error);
    return null;
  }

  const creators = await getCampaignCreators(supabase, campaignId);

  return { ...(campaign as Campaign), creators } as CampaignWithCreators;
}

/* ------------------------------------------------------------------ */
/*  Create a campaign                                                  */
/* ------------------------------------------------------------------ */

export async function createCampaign(
  supabase: SupabaseClient<Database>,
  campaign: CampaignInsert,
): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert(campaign as never)
    .select()
    .single();

  if (error) {
    console.error("createCampaign error:", error);
    throw error;
  }

  return data;
}

/* ------------------------------------------------------------------ */
/*  Update a campaign                                                  */
/* ------------------------------------------------------------------ */

export async function updateCampaign(
  supabase: SupabaseClient<Database>,
  campaignId: string,
  updates: CampaignUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("campaigns")
    .update(updates as never)
    .eq("id", campaignId);

  if (error) {
    console.error("updateCampaign error:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Add a creator to a campaign                                        */
/* ------------------------------------------------------------------ */

export async function addCreatorToCampaign(
  supabase: SupabaseClient<Database>,
  campaignId: string,
  creatorId: string,
  matchScore: number | null,
): Promise<void> {
  // match_score_at_assignment is a 0-100 column for display continuity.
  // The matching engine writes creator_brand_matches.match_score as 0-1,
  // so scale up here. Values >1 are treated as already on the 0-100 scale.
  const scorePct =
    matchScore == null
      ? null
      : matchScore > 1
        ? Math.round(matchScore * 10) / 10
        : Math.round(matchScore * 1000) / 10;
  const { error } = await supabase.from("campaign_creators").insert({
    campaign_id: campaignId,
    creator_id: creatorId,
    status: "shortlisted",
    match_score_at_assignment: scorePct,
  } as never);

  if (error) {
    // Ignore duplicate
    if (error.code === "23505") return;
    console.error("addCreatorToCampaign error:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Update a campaign creator's status                                 */
/* ------------------------------------------------------------------ */

export async function updateCampaignCreatorStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: string,
  agreedRate?: number | null,
): Promise<void> {
  const updates: Record<string, unknown> = { status };

  if (agreedRate !== undefined) {
    updates.agreed_rate = agreedRate;
  }

  if (status === "confirmed") {
    updates.confirmed_at = new Date().toISOString();
  } else if (status === "completed") {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("campaign_creators")
    .update(updates as never)
    .eq("id", id);

  if (error) {
    console.error("updateCampaignCreatorStatus error:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Get all creators for a campaign                                    */
/* ------------------------------------------------------------------ */

export async function getCampaignCreators(
  supabase: SupabaseClient<Database>,
  campaignId: string,
): Promise<CampaignCreatorWithDetails[]> {
  const { data, error } = await supabase
    .from("campaign_creators")
    .select(
      `
      *,
      creator:creators (
        id,
        handle,
        display_name,
        avatar_url,
        followers,
        tier,
        is_verified,
        city,
        country
      )
    `,
    )
    .eq("campaign_id", campaignId)
    .order("assigned_at", { ascending: false });

  if (error) {
    console.error("getCampaignCreators error:", error);
    return [];
  }

  return (data ?? []) as CampaignCreatorWithDetails[];
}

/* ------------------------------------------------------------------ */
/*  Get campaign creator status counts                                 */
/* ------------------------------------------------------------------ */

export function getStatusCounts(
  creators: CampaignCreatorWithDetails[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of creators) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  }
  return counts;
}

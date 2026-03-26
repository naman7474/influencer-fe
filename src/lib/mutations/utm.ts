import type { SupabaseClient } from "@supabase/supabase-js";
import { generateUtmLink, slugify } from "@/lib/outreach/utm";

export async function createUtmLink(
  supabase: SupabaseClient,
  brandId: string,
  input: {
    campaignId: string;
    creatorId: string;
    campaignCreatorId?: string | null;
    brandWebsite: string;
    campaignName: string;
    creatorHandle: string;
  }
) {
  const fullUrl = generateUtmLink(
    input.brandWebsite,
    slugify(input.campaignName),
    input.creatorHandle
  );

  const { data, error } = await supabase
    .from("campaign_utm_links")
    .upsert(
      {
        brand_id: brandId,
        campaign_id: input.campaignId,
        creator_id: input.creatorId,
        campaign_creator_id: input.campaignCreatorId ?? null,
        utm_source: "influencer",
        utm_medium: slugify(input.creatorHandle),
        utm_campaign: slugify(input.campaignName),
        full_url: fullUrl,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "campaign_id,creator_id",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

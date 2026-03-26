import { apiError, apiOk } from "@/lib/api";
import { createUtmLink } from "@/lib/mutations/utm";
import { requireBrandContext } from "@/lib/queries/brand";
import { getCreatorAttribution } from "@/lib/queries/attribution";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; creatorId: string }> }
) {
  try {
    const { id, creatorId } = await context.params;
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const link = await getCreatorAttribution(supabase, brand.brand_id, id, creatorId);
    return apiOk({ utm_link: link });
  } catch (error) {
    return apiError(500, {
      code: "utm_fetch_failed",
      message: error instanceof Error ? error.message : "Unable to fetch UTM link.",
    });
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; creatorId: string }> }
) {
  try {
    const { id, creatorId } = await context.params;
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const [campaignRes, creatorRes, campaignCreatorRes] = await Promise.all([
      supabase
        .from("campaigns")
        .select("id, name")
        .eq("brand_id", brand.brand_id)
        .eq("id", id)
        .single(),
      supabase
        .from("creators")
        .select("id, handle")
        .eq("id", creatorId)
        .single(),
      supabase
        .from("campaign_creators")
        .select("id")
        .eq("campaign_id", id)
        .eq("creator_id", creatorId)
        .maybeSingle(),
    ]);

    if (campaignRes.error) throw campaignRes.error;
    if (creatorRes.error) throw creatorRes.error;
    if (campaignCreatorRes.error) throw campaignCreatorRes.error;

    if (!brand.website) {
      return apiError(400, {
        code: "missing_brand_website",
        message: "Set a brand website before generating UTM links.",
      });
    }

    const utmLink = await createUtmLink(supabase, brand.brand_id, {
      campaignId: id,
      creatorId,
      campaignCreatorId: campaignCreatorRes.data?.id ?? null,
      brandWebsite: brand.website,
      campaignName: campaignRes.data.name,
      creatorHandle: creatorRes.data.handle,
    });

    return apiOk({ utm_link: utmLink }, undefined, 201);
  } catch (error) {
    return apiError(500, {
      code: "utm_create_failed",
      message: error instanceof Error ? error.message : "Unable to create UTM link.",
    });
  }
}

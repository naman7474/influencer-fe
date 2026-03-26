import { apiError, apiOk } from "@/lib/api";
import { getCampaignAttribution } from "@/lib/queries/attribution";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const attribution = await getCampaignAttribution(supabase, brand.brand_id, id);
    return apiOk(attribution);
  } catch (error) {
    return apiError(500, {
      code: "campaign_attribution_fetch_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch campaign attribution.",
    });
  }
}

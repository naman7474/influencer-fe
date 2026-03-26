import { apiError, apiOk } from "@/lib/api";
import { triggerCampaignAttributionJob } from "@/lib/jobs";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    await triggerCampaignAttributionJob(brand.brand_id, { campaign_id: id });
    return apiOk({ queued: true });
  } catch (error) {
    return apiError(500, {
      code: "campaign_performance_refresh_failed",
      message:
        error instanceof Error ? error.message : "Unable to refresh campaign performance.",
    });
  }
}

import { apiError, apiOk } from "@/lib/api";
import { requireBrandContext } from "@/lib/queries/brand";
import {
  getCampaignCreatorPerformance,
  getCampaignPerformance,
  getCampaignPerformanceTimeSeries,
  getCampaignRegionalPerformance,
} from "@/lib/queries/performance";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const [summary, creators, regions, timeSeries] = await Promise.all([
      getCampaignPerformance(supabase, brand.brand_id, id),
      getCampaignCreatorPerformance(supabase, brand.brand_id, id),
      getCampaignRegionalPerformance(supabase, brand.brand_id, id),
      getCampaignPerformanceTimeSeries(supabase, brand.brand_id, id),
    ]);

    return apiOk({
      summary,
      creators,
      regions,
      time_series: timeSeries,
    });
  } catch (error) {
    return apiError(500, {
      code: "campaign_performance_fetch_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch campaign performance.",
    });
  }
}

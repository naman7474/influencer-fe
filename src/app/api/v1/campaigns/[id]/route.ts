import { apiError, apiOk } from "@/lib/api";
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

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("brand_id", brand.brand_id)
      .single();

    if (error) {
      throw error;
    }

    return apiOk({ campaign: data });
  } catch (error) {
    return apiError(500, {
      code: "campaign_detail_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch campaign.",
    });
  }
}

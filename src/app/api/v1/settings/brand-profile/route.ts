import { apiError, apiOk } from "@/lib/api";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      brand_name?: string;
      website?: string | null;
      industry?: string | null;
    };
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const { data, error } = await supabase
      .from("brands")
      .update({
        brand_name: body.brand_name?.trim() || brand.brand_name,
        website: body.website?.trim() || null,
        industry: body.industry?.trim() || null,
      })
      .eq("id", brand.brand_id)
      .select("brand_name, website, industry")
      .single();

    if (error) {
      throw error;
    }

    return apiOk({ brand: data });
  } catch (error) {
    return apiError(500, {
      code: "settings_update_failed",
      message:
        error instanceof Error ? error.message : "Unable to update brand settings.",
    });
  }
}

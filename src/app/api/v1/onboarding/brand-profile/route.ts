import { apiError, apiOk } from "@/lib/api";
import { saveBrandProfile } from "@/lib/mutations/onboarding";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";
import type { SaveBrandProfileRequest } from "@/types/api";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveBrandProfileRequest;
    if (!body.brand_name?.trim()) {
      return apiError(400, {
        code: "validation_error",
        message: "Brand name is required.",
      });
    }

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const updatedBrand = await saveBrandProfile(supabase, brand.brand_id, body);

    return apiOk({
      completed_step: 1,
      next_step: 2,
      brand: updatedBrand,
    });
  } catch (error) {
    return apiError(500, {
      code: "brand_profile_save_failed",
      message:
        error instanceof Error ? error.message : "Unable to save brand profile.",
    });
  }
}

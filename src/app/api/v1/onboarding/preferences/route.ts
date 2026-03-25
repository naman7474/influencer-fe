import { apiError, apiOk } from "@/lib/api";
import { saveBrandPreferences } from "@/lib/mutations/onboarding";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";
import type { SaveBrandPreferencesRequest } from "@/types/api";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveBrandPreferencesRequest;
    if (!body.default_campaign_goal) {
      return apiError(400, {
        code: "validation_error",
        message: "Default campaign goal is required.",
      });
    }

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    await saveBrandPreferences(supabase, brand.brand_id, body);

    return apiOk({
      completed_step: 3,
      onboarding_complete: true,
      background_jobs: brand.shopify_connected
        ? [
          {
              job_type: "shopify_sync",
              status: "queued" as const,
            },
          ]
        : [],
    });
  } catch (error) {
    return apiError(500, {
      code: "preferences_save_failed",
      message:
        error instanceof Error ? error.message : "Unable to save preferences.",
    });
  }
}

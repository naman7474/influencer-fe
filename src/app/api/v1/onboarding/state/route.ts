import { apiError, apiOk } from "@/lib/api";
import { requireBrandContext } from "@/lib/queries/brand";
import { getOnboardingState } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const onboarding = await getOnboardingState(supabase, brand.brand_id);

    return apiOk({ onboarding });
  } catch (error) {
    return apiError(401, {
      code: "unauthenticated",
      message:
        error instanceof Error ? error.message : "Unable to load onboarding state.",
    });
  }
}

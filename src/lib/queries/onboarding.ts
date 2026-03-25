import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingState } from "@/types/api";
import { currencyToPaise } from "@/lib/api";

function mapGoalFromDb(value: string | null): OnboardingState["preferences"]["default_campaign_goal"] {
  if (value === "awareness" || value === "conversion") {
    return value;
  }

  if (value === "ugc_generation") {
    return "ugc";
  }

  return null;
}

export async function getOnboardingState(
  supabase: SupabaseClient,
  brandId: string
): Promise<OnboardingState> {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();

  if (error) {
    throw error;
  }

  const step = Math.min(Math.max((data.onboarding_step ?? 0) + 1, 1), 3) as
    | 1
    | 2
    | 3;

  return {
    is_complete: (data.onboarding_step ?? 0) >= 3,
    current_step: step,
    brand_profile: {
      brand_name: data.brand_name,
      website: data.website,
      logo_url: data.logo_url,
      industry: data.industry,
    },
    shopify: {
      shopify_connected: Boolean(data.shopify_connected),
      store_url: data.shopify_store_url,
      last_sync_at: data.shopify_last_sync_at,
      sync_status: data.shopify_sync_status ?? "idle",
      sync_error: data.shopify_sync_error ?? null,
    },
    preferences: {
      default_campaign_goal: mapGoalFromDb(data.default_campaign_goal),
      budget_per_creator_min_paise: currencyToPaise(data.budget_per_creator_min),
      budget_per_creator_max_paise: currencyToPaise(data.budget_per_creator_max),
      content_format_pref: data.content_format_pref
        ? [String(data.content_format_pref)]
        : [],
      past_collaborations: data.past_collaborations ?? [],
      competitor_brands: data.competitor_brands ?? [],
    },
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  paiseToCurrency,
  parseStringArray,
} from "@/lib/api";
import type {
  SaveBrandPreferencesRequest,
  SaveBrandProfileRequest,
} from "@/types/api";
import { getBrandContext } from "@/lib/queries/brand";

function mapGoalToDb(value: SaveBrandPreferencesRequest["default_campaign_goal"]) {
  if (value === "ugc") {
    return "ugc_generation";
  }

  return value;
}

function getContentFormatValue(values: string[]): string {
  const firstValue = values[0];

  if (
    firstValue === "reels" ||
    firstValue === "static" ||
    firstValue === "carousel" ||
    firstValue === "any"
  ) {
    return firstValue;
  }

  return "any";
}

export async function saveBrandProfile(
  supabase: SupabaseClient,
  brandId: string,
  input: SaveBrandProfileRequest
) {
  const { error } = await supabase
    .from("brands")
    .update({
      brand_name: input.brand_name.trim(),
      website: input.website?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      industry: input.industry?.trim() || null,
      onboarding_step: 1,
    })
    .eq("id", brandId);

  if (error) {
    throw error;
  }

  const brand = await getBrandContext(supabase);
  if (!brand) {
    throw new Error("Brand context missing after profile save.");
  }

  return brand;
}

export async function saveShopifyConnect(
  supabase: SupabaseClient,
  brandId: string,
  storeUrl: string,
  adminAccessToken?: string | null
) {
  const trimmedToken = adminAccessToken?.trim() || null;
  const { error } = await supabase
    .from("brands")
    .update({
      shopify_store_url: storeUrl,
      shopify_admin_access_token: trimmedToken || undefined,
      shopify_connected: Boolean(trimmedToken),
      shopify_sync_status: trimmedToken ? "queued" : "idle",
      shopify_sync_error: null,
      shopify_sync_started_at: null,
      shopify_sync_completed_at: null,
      onboarding_step: 2,
    })
    .eq("id", brandId);

  if (error) {
    throw error;
  }
}

export async function saveBrandPreferences(
  supabase: SupabaseClient,
  brandId: string,
  input: SaveBrandPreferencesRequest
) {
  const { error } = await supabase
    .from("brands")
    .update({
      default_campaign_goal: mapGoalToDb(input.default_campaign_goal),
      budget_per_creator_min: paiseToCurrency(
        input.budget_per_creator_min_paise
      ),
      budget_per_creator_max: paiseToCurrency(
        input.budget_per_creator_max_paise
      ),
      content_format_pref: getContentFormatValue(
        parseStringArray(input.content_format_pref)
      ),
      past_collaborations: parseStringArray(input.past_collaborations),
      competitor_brands: parseStringArray(input.competitor_brands),
      onboarding_step: 3,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", brandId);

  if (error) {
    throw error;
  }
}

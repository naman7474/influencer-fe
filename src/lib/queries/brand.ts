import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandContextRecord } from "@/types/api";
import { createServiceRoleClient } from "@/lib/supabase/server";

function toBillingPlan(plan: string | null | undefined): BrandContextRecord["billing_plan"] {
  if (
    plan === "starter" ||
    plan === "growth" ||
    plan === "scale" ||
    plan === "enterprise"
  ) {
    return plan;
  }

  return "growth";
}

export async function getBrandContext(
  supabase: SupabaseClient
): Promise<BrandContextRecord | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    brand_id: data.id,
    auth_user_id: data.auth_user_id,
    brand_name: data.brand_name,
    logo_url: data.logo_url,
    industry: data.industry,
    website: data.website,
    shopify_connected: Boolean(data.shopify_connected),
    billing_plan: toBillingPlan(null),
    user_role: "owner",
    feature_flags: {
      geo_enabled: Boolean(data.shopify_connected),
      campaigns_enabled: true,
      billing_enabled: true,
      brand_fit_enabled: true,
    },
    onboarding_step: data.onboarding_step ?? 0,
    shopify_store_url: data.shopify_store_url,
    shopify_connected_at: data.shopify_connected_at,
    shopify_last_sync_at: data.shopify_last_sync_at,
    shopify_sync_status: data.shopify_sync_status ?? "idle",
    shopify_sync_error: data.shopify_sync_error ?? null,
    shopify_sync_started_at: data.shopify_sync_started_at ?? null,
    shopify_sync_completed_at: data.shopify_sync_completed_at ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function requireBrandContext(
  supabase: SupabaseClient
): Promise<BrandContextRecord> {
  const brand = await getBrandContext(supabase);

  if (!brand) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      throw new Error("No authenticated Supabase user found for the current session.");
    }

    const serviceRole = createServiceRoleClient();
    const { data: fallbackBrand, error: fallbackError } = await serviceRole
      .from("brands")
      .select("id, auth_user_id, brand_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (fallbackError) {
      throw fallbackError;
    }

    if (fallbackBrand) {
      throw new Error(
        `Brand row exists for authenticated user ${user.id}, but it was not visible through the session client. Check Supabase RLS and session cookies.`
      );
    }

    throw new Error(
      `Brand context not found for authenticated user ${user.id}. Check that public.brands.auth_user_id matches the current auth.users.id.`
    );
  }

  return brand;
}

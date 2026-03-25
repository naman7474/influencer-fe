import type { SupabaseClient } from "@supabase/supabase-js";

export async function createCampaign(
  supabase: SupabaseClient,
  brandId: string,
  input: {
    name: string;
    description?: string | null;
    goal?: string | null;
    total_budget?: number | null;
    budget_per_creator?: number | null;
  }
) {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      brand_id: brandId,
      name: input.name,
      description: input.description ?? null,
      goal:
        input.goal === "conversion" || input.goal === "ugc_generation"
          ? input.goal
          : "awareness",
      total_budget: input.total_budget ?? null,
      budget_per_creator: input.budget_per_creator ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

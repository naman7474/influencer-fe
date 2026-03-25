import { apiError, apiOk } from "@/lib/api";
import { createCampaign } from "@/lib/mutations/campaigns";
import { requireBrandContext } from "@/lib/queries/brand";
import { getCampaignsOverview } from "@/lib/queries/campaigns";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const campaigns = await getCampaignsOverview(supabase, brand.brand_id);
    return apiOk(campaigns);
  } catch (error) {
    return apiError(500, {
      code: "campaigns_fetch_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch campaigns.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
      goal?: string | null;
      total_budget?: number | null;
      budget_per_creator?: number | null;
    };

    if (!body.name?.trim()) {
      return apiError(400, {
        code: "validation_error",
        message: "Campaign name is required.",
      });
    }

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const campaign = await createCampaign(supabase, brand.brand_id, {
      name: body.name.trim(),
      description: body.description ?? null,
      goal: body.goal ?? null,
      total_budget: body.total_budget ?? null,
      budget_per_creator: body.budget_per_creator ?? null,
    });

    return apiOk({ campaign }, undefined, 201);
  } catch (error) {
    return apiError(500, {
      code: "campaign_create_failed",
      message:
        error instanceof Error ? error.message : "Unable to create campaign.",
    });
  }
}

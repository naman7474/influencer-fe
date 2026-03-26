import { apiError, apiOk } from "@/lib/api";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      creator_id?: string;
      status?: string;
    };

    if (!body.creator_id) {
      return apiError(400, {
        code: "validation_error",
        message: "creator_id is required.",
      });
    }

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", id)
      .eq("brand_id", brand.brand_id)
      .maybeSingle();

    if (campaignError) {
      throw campaignError;
    }

    if (!campaign) {
      return apiError(404, {
        code: "campaign_not_found",
        message: "Campaign not found.",
      });
    }

    const { data, error } = await supabase
      .from("campaign_creators")
      .upsert(
        {
          campaign_id: id,
          creator_id: body.creator_id,
          status: body.status ?? "shortlisted",
        },
        { onConflict: "campaign_id,creator_id" }
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return apiOk({ campaign_creator: data }, undefined, 201);
  } catch (error) {
    return apiError(500, {
      code: "campaign_creator_create_failed",
      message:
        error instanceof Error ? error.message : "Unable to add creator to campaign.",
    });
  }
}

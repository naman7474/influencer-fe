import { apiError, apiOk } from "@/lib/api";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const { data, error } = await supabase
      .from("inbound_creators")
      .select("*, creator:creators(*)")
      .eq("brand_id", brand.brand_id)
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return apiOk({ inbound_creator: data });
  } catch (error) {
    return apiError(500, {
      code: "inbound_detail_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch inbound creator.",
    });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: "accepted" | "rejected";
      campaign_id?: string | null;
    };

    if (!body.status) {
      return apiError(400, {
        code: "validation_error",
        message: "A status is required.",
      });
    }

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const { data, error } = await supabase
      .from("inbound_creators")
      .update({
        status: body.status,
        updated_at: new Date().toISOString(),
      })
      .eq("brand_id", brand.brand_id)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    if (body.status === "accepted" && body.campaign_id && data.linked_creator_id) {
      const insertRes = await supabase
        .from("campaign_creators")
        .upsert(
          {
            campaign_id: body.campaign_id,
            creator_id: data.linked_creator_id,
            status: "shortlisted",
          },
          { onConflict: "campaign_id,creator_id" }
        );

      if (insertRes.error) {
        throw insertRes.error;
      }
    }

    return apiOk({ inbound_creator: data });
  } catch (error) {
    return apiError(500, {
      code: "inbound_update_failed",
      message:
        error instanceof Error ? error.message : "Unable to update inbound creator.",
    });
  }
}

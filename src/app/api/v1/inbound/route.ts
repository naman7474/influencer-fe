import { apiError, apiOk } from "@/lib/api";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    let query = supabase
      .from("inbound_creators")
      .select(
        "*, creator:creators(id, handle, display_name, avatar_url, followers)"
      )
      .eq("brand_id", brand.brand_id)
      .order("last_message_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return apiOk({ inbound_creators: data ?? [] });
  } catch (error) {
    return apiError(500, {
      code: "inbound_fetch_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch inbound creators.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      ids?: string[];
      status?: "accepted" | "rejected";
      campaign_id?: string | null;
    };

    if (!body.ids?.length || !body.status) {
      return apiError(400, {
        code: "validation_error",
        message: "Inbound ids and a target status are required.",
      });
    }

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const updated = await supabase
      .from("inbound_creators")
      .update({
        status: body.status,
        updated_at: new Date().toISOString(),
      })
      .eq("brand_id", brand.brand_id)
      .in("id", body.ids)
      .select("*");

    if (updated.error) {
      throw updated.error;
    }

    if (body.status === "accepted" && body.campaign_id) {
      const inserts = (updated.data ?? [])
        .filter((row) => row.linked_creator_id)
        .map((row) => ({
          campaign_id: body.campaign_id,
          creator_id: row.linked_creator_id,
          status: "shortlisted",
        }));

      if (inserts.length) {
        const insertRes = await supabase
          .from("campaign_creators")
          .upsert(inserts, { onConflict: "campaign_id,creator_id" });

        if (insertRes.error) {
          throw insertRes.error;
        }
      }
    }

    return apiOk({ inbound_creators: updated.data ?? [] });
  } catch (error) {
    return apiError(500, {
      code: "inbound_bulk_update_failed",
      message:
        error instanceof Error ? error.message : "Unable to update inbound creators.",
    });
  }
}

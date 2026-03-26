import { apiError, apiOk } from "@/lib/api";
import {
  deleteOutreachTemplate,
  updateOutreachTemplate,
} from "@/lib/mutations/outreach";
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
      .from("outreach_templates")
      .select("*")
      .eq("brand_id", brand.brand_id)
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return apiOk({ template: data });
  } catch (error) {
    return apiError(500, {
      code: "outreach_template_fetch_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch outreach template.",
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
      name?: string;
      channel?: string;
      subject?: string | null;
      body?: string;
      followup_enabled?: boolean;
      followup_days?: number;
      followup_subject?: string | null;
      followup_body?: string | null;
      max_followups?: number;
    };

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const template = await updateOutreachTemplate(supabase, brand.brand_id, id, body);
    return apiOk({ template });
  } catch (error) {
    return apiError(500, {
      code: "outreach_template_update_failed",
      message:
        error instanceof Error ? error.message : "Unable to update outreach template.",
    });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    await deleteOutreachTemplate(supabase, brand.brand_id, id);
    return apiOk({ deleted: true });
  } catch (error) {
    return apiError(500, {
      code: "outreach_template_delete_failed",
      message:
        error instanceof Error ? error.message : "Unable to delete outreach template.",
    });
  }
}

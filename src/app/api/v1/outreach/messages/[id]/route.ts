import { apiError, apiOk } from "@/lib/api";
import { getOutreachMessageDetail, getOutreachReplies } from "@/lib/queries/outreach";
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
    const [message, replies] = await Promise.all([
      getOutreachMessageDetail(supabase, brand.brand_id, id),
      getOutreachReplies(supabase, brand.brand_id, id),
    ]);
    return apiOk({ message, replies });
  } catch (error) {
    return apiError(500, {
      code: "outreach_message_fetch_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch outreach message.",
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
      subject?: string | null;
      body?: string | null;
      channel?: string;
      recipient_email?: string | null;
    };

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const { data: current, error: currentError } = await supabase
      .from("outreach_messages")
      .select("id, status")
      .eq("brand_id", brand.brand_id)
      .eq("id", id)
      .single();

    if (currentError) {
      throw currentError;
    }

    if (current.status !== "draft") {
      return apiError(409, {
        code: "message_not_editable",
        message: "Only draft outreach messages can be edited.",
      });
    }

    const { data, error } = await supabase
      .from("outreach_messages")
      .update({
        subject: body.subject ?? undefined,
        body: body.body ?? undefined,
        channel: body.channel ?? undefined,
        recipient_email: body.recipient_email ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("brand_id", brand.brand_id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return apiOk({ message: data });
  } catch (error) {
    return apiError(500, {
      code: "outreach_message_update_failed",
      message:
        error instanceof Error ? error.message : "Unable to update outreach message.",
    });
  }
}

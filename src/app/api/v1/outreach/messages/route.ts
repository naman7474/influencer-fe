import { apiError, apiOk } from "@/lib/api";
import {
  bulkQueueOutreach,
  createOutreachMessage,
  queueOutreachMessage,
} from "@/lib/mutations/outreach";
import { renderTemplate } from "@/lib/outreach/render-template";
import { requireBrandContext } from "@/lib/queries/brand";
import { getOutreachMessages } from "@/lib/queries/outreach";
import { createClient } from "@/lib/supabase/server";

async function buildRenderedMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
  input: {
    campaign_id?: string | null;
    creator_ids: string[];
    template_id?: string | null;
    channel: string;
    subject?: string | null;
    body?: string | null;
  }
) {
  const [brandRes, campaignRes, creatorsRes, templateRes, utmRes] = await Promise.all([
    supabase.from("brands").select("brand_name").eq("id", brandId).single(),
    input.campaign_id
      ? supabase
          .from("campaigns")
          .select("id, name")
          .eq("id", input.campaign_id)
          .eq("brand_id", brandId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("creators")
      .select("id, handle, display_name, contact_email")
      .in("id", input.creator_ids),
    input.template_id
      ? supabase
          .from("outreach_templates")
          .select("*")
          .eq("id", input.template_id)
          .eq("brand_id", brandId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.campaign_id
      ? supabase
          .from("campaign_utm_links")
          .select("creator_id, full_url")
          .eq("campaign_id", input.campaign_id)
          .in("creator_id", input.creator_ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (brandRes.error) throw brandRes.error;
  if (campaignRes.error) throw campaignRes.error;
  if (creatorsRes.error) throw creatorsRes.error;
  if (templateRes.error) throw templateRes.error;
  if (utmRes.error) throw utmRes.error;

  const template = templateRes.data;
  const bodyTemplate = input.body ?? template?.body;
  const subjectTemplate =
    input.subject ?? template?.subject ?? (input.channel === "email" ? "Creator partnership" : null);

  if (!bodyTemplate) {
    throw new Error("Outreach body is required.");
  }

  const utmByCreator = new Map<string, string>();
  for (const row of utmRes.data ?? []) {
    utmByCreator.set(row.creator_id, row.full_url);
  }

  return (creatorsRes.data ?? []).map((creator) => {
    const context = {
      creator_name: creator.display_name ?? creator.handle,
      brand_name: brandRes.data.brand_name,
      handle: creator.handle,
      campaign_name: campaignRes.data?.name ?? "",
      utm_link: utmByCreator.get(creator.id) ?? "",
    };

    return {
      campaign_id: input.campaign_id ?? null,
      creator_id: creator.id,
      template_id: template?.id ?? null,
      channel: input.channel,
      subject: subjectTemplate ? renderTemplate(subjectTemplate, context) : null,
      body: renderTemplate(bodyTemplate, context),
      recipient_email: creator.contact_email ?? null,
      metadata: {
        creator_handle: creator.handle,
      },
    };
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const messages = await getOutreachMessages(supabase, brand.brand_id, {
      campaignId: url.searchParams.get("campaign_id"),
      creatorId: url.searchParams.get("creator_id"),
      status: url.searchParams.get("status"),
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("page_size") ?? 20),
    });

    return apiOk(messages, {
      page: messages.page,
      page_size: messages.pageSize,
      total: messages.total,
      total_pages: Math.max(1, Math.ceil(messages.total / messages.pageSize)),
    });
  } catch (error) {
    return apiError(500, {
      code: "outreach_messages_fetch_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch outreach messages.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      campaign_id?: string | null;
      creator_ids?: string[];
      template_id?: string | null;
      channel?: string;
      subject?: string | null;
      body?: string | null;
      save_as_draft?: boolean;
      message_id?: string | null;
    };

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    if (body.message_id) {
      const queued = await queueOutreachMessage(supabase, brand.brand_id, body.message_id);
      return apiOk({ message: queued });
    }

    const creatorIds = (body.creator_ids ?? []).filter(Boolean);
    if (!creatorIds.length) {
      return apiError(400, {
        code: "validation_error",
        message: "At least one creator is required.",
      });
    }

    const renderedRows = await buildRenderedMessages(supabase, brand.brand_id, {
      campaign_id: body.campaign_id ?? null,
      creator_ids: creatorIds,
      template_id: body.template_id ?? null,
      channel: body.channel ?? "email",
      subject: body.subject ?? null,
      body: body.body ?? null,
    });

    if (body.save_as_draft && renderedRows.length === 1) {
      const message = await createOutreachMessage(supabase, brand.brand_id, renderedRows[0]);
      return apiOk({ message }, undefined, 201);
    }

    const messages = await bulkQueueOutreach(supabase, brand.brand_id, renderedRows);
    return apiOk({ messages }, undefined, 201);
  } catch (error) {
    return apiError(500, {
      code: "outreach_message_create_failed",
      message:
        error instanceof Error ? error.message : "Unable to create outreach messages.",
    });
  }
}

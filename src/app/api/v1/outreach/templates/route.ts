import { apiError, apiOk } from "@/lib/api";
import {
  createOutreachTemplate,
} from "@/lib/mutations/outreach";
import { requireBrandContext } from "@/lib/queries/brand";
import { getOutreachTemplates } from "@/lib/queries/outreach";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const templates = await getOutreachTemplates(supabase, brand.brand_id);
    return apiOk({ templates });
  } catch (error) {
    return apiError(500, {
      code: "outreach_templates_fetch_failed",
      message:
        error instanceof Error ? error.message : "Unable to fetch outreach templates.",
    });
  }
}

export async function POST(request: Request) {
  try {
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

    if (!body.name?.trim() || !body.body?.trim()) {
      return apiError(400, {
        code: "validation_error",
        message: "Template name and body are required.",
      });
    }

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const template = await createOutreachTemplate(supabase, brand.brand_id, {
      name: body.name.trim(),
      channel: body.channel ?? "email",
      subject: body.subject ?? null,
      body: body.body.trim(),
      followup_enabled: body.followup_enabled ?? false,
      followup_days: body.followup_days ?? 3,
      followup_subject: body.followup_subject ?? null,
      followup_body: body.followup_body ?? null,
      max_followups: body.max_followups ?? 1,
    });

    return apiOk({ template }, undefined, 201);
  } catch (error) {
    return apiError(500, {
      code: "outreach_template_create_failed",
      message:
        error instanceof Error ? error.message : "Unable to create outreach template.",
    });
  }
}

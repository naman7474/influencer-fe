import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { generateBrandMd } from "@/lib/agent/brand-md";
import { DEFAULT_SOUL_MD } from "@/lib/agent/soul-md";
import type { AgentConfig, Brand } from "@/lib/types/database";

export async function GET() {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const { data: configRow } = await supabase
      .from("agent_config")
      .select("*")
      .eq("brand_id", brand.id)
      .maybeSingle();
    const config = configRow as AgentConfig | null;

    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error("[agent/config GET]", err);
    return NextResponse.json(
      { error: "Failed to load agent config" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: brandRow } = await supabase
      .from("brands")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as Brand | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const body = await request.json();

    // Check if config already exists (use maybeSingle to avoid 406 on no rows)
    const { data: existingRow } = await supabase
      .from("agent_config")
      .select("id")
      .eq("brand_id", brand.id)
      .maybeSingle();
    const existing = existingRow as { id: string } | null;

    if (existing) {
      // Update existing config
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body.soul_md !== undefined) updateData.soul_md = body.soul_md;
      if (body.brand_md !== undefined) updateData.brand_md = body.brand_md;
      if (body.autonomy_level !== undefined)
        updateData.autonomy_level = body.autonomy_level;
      if (body.can_search_creators !== undefined)
        updateData.can_search_creators = body.can_search_creators;
      if (body.can_draft_outreach !== undefined)
        updateData.can_draft_outreach = body.can_draft_outreach;
      if (body.temperature !== undefined)
        updateData.temperature = body.temperature;
      if (body.daily_message_limit !== undefined)
        updateData.daily_message_limit = body.daily_message_limit;
      if (body.model_name !== undefined)
        updateData.model_name = body.model_name;
      // Phase 5: per-action autonomy
      if (body.action_autonomy !== undefined)
        updateData.action_autonomy = body.action_autonomy;
      if (body.budget_auto_threshold !== undefined)
        updateData.budget_auto_threshold = body.budget_auto_threshold;
      // Phase 5: new permissions
      if (body.can_track_performance !== undefined)
        updateData.can_track_performance = body.can_track_performance;
      if (body.can_manage_relationships !== undefined)
        updateData.can_manage_relationships = body.can_manage_relationships;
      if (body.can_manage_budget !== undefined)
        updateData.can_manage_budget = body.can_manage_budget;
      if (body.can_scan_content !== undefined)
        updateData.can_scan_content = body.can_scan_content;
      if (body.can_generate_reports !== undefined)
        updateData.can_generate_reports = body.can_generate_reports;

      const { data: updated, error } = await supabase
        .from("agent_config")
        .update(updateData as never)
        .eq("brand_id", brand.id)
        .select()
        .single();

      if (error) {
        console.error("[agent/config POST] update error:", error);
        return NextResponse.json(
          { error: `Failed to update: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, config: updated });
    }

    // Create new config with auto-generated BRAND.md
    const brandMd = generateBrandMd(brand);

    const { data: created, error } = await supabase
      .from("agent_config")
      .insert({
        brand_id: brand.id,
        soul_md: body.soul_md || DEFAULT_SOUL_MD,
        brand_md: body.brand_md || brandMd,
        autonomy_level: body.autonomy_level || "suggest_only",
        can_search_creators: body.can_search_creators ?? true,
        can_draft_outreach: body.can_draft_outreach ?? true,
        temperature: body.temperature ?? 0.7,
        daily_message_limit: body.daily_message_limit ?? 200,
      } as never)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to create: ${error.message}` },
        { status: 500 }
      );
    }

    // Enable agent on brand
    await supabase
      .from("brands")
      .update({ agent_enabled: true } as never)
      .eq("id", brand.id);

    return NextResponse.json({ success: true, config: created }, { status: 201 });
  } catch (err) {
    console.error("[agent/config POST]", err);
    return NextResponse.json(
      { error: "Failed to save agent config" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export interface CustomSkillRow {
  id: string;
  brand_id: string;
  name: string;
  label: string;
  description: string;
  category: string;
  input_schema: Record<string, unknown>;
  execution_type: "prompt" | "api" | "query";
  execution_config: Record<string, unknown>;
  risk_level: "low" | "medium" | "high";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/agent/custom-skills
 * List all custom skills for the authenticated brand.
 */
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

    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("custom_skills")
      .select("*")
      .eq("brand_id", (brand as { id: string }).id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ skills: (data || []) as CustomSkillRow[] });
  } catch {
    return NextResponse.json(
      { error: "Failed to load custom skills" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/custom-skills
 * Create a new custom skill.
 */
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

    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const body = await request.json();
    const brandId = (brand as { id: string }).id;

    // Validate required fields
    const { name, label, description, input_schema, execution_type, execution_config, risk_level, category } = body;

    if (!name || !label || !description || !execution_type) {
      return NextResponse.json(
        { error: "Missing required fields: name, label, description, execution_type" },
        { status: 400 }
      );
    }

    // Validate name format (alphanumeric + underscores only)
    if (!/^[a-z][a-z0-9_]{2,49}$/.test(name)) {
      return NextResponse.json(
        { error: "Name must be 3-50 chars, lowercase, start with letter, only letters/numbers/underscores" },
        { status: 400 }
      );
    }

    // Check for name conflicts with built-in skills
    const RESERVED_NAMES = [
      "creator_search", "get_creator_details", "lookalike_finder", "competitor_mapper",
      "audience_overlap_check", "geo_opportunity_finder", "warm_lead_detector",
      "outreach_drafter", "propose_outreach", "rate_benchmarker", "counter_offer_generator",
      "budget_optimizer", "deal_memo_generator", "get_campaign_info", "campaign_builder",
      "discount_code_generator", "utm_generator", "brief_generator", "gifting_order_creator",
      "order_attributor", "content_monitor", "roi_calculator", "geo_lift_analyzer",
      "campaign_reporter", "compliance_scanner", "relationship_scorer",
      "reengagement_recommender", "ambassador_identifier", "churn_predictor",
    ];

    if (RESERVED_NAMES.includes(name)) {
      return NextResponse.json(
        { error: "This name conflicts with a built-in skill. Choose a different name." },
        { status: 400 }
      );
    }

    const { data, error } = await (
      supabase.from("custom_skills") as ReturnType<typeof supabase.from>
    ).insert({
      brand_id: brandId,
      name,
      label,
      description,
      category: category || "custom",
      input_schema: input_schema || { type: "object", properties: {} },
      execution_type,
      execution_config: execution_config || {},
      risk_level: risk_level || "medium",
    } as never).select().single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A skill with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ skill: data as CustomSkillRow }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create custom skill" },
      { status: 500 }
    );
  }
}

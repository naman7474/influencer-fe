import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/agent/custom-skills/[id]
 * Update an existing custom skill.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Build update payload — only include fields that were sent
    const updateFields: Record<string, unknown> = {};
    const allowedFields = [
      "label",
      "description",
      "category",
      "input_schema",
      "execution_type",
      "execution_config",
      "risk_level",
      "is_active",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await (
      supabase.from("custom_skills") as ReturnType<typeof supabase.from>
    )
      .update(updateFields as never)
      .eq("id", id)
      .eq("brand_id", brandId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json({ skill: data });
  } catch {
    return NextResponse.json(
      { error: "Failed to update custom skill" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent/custom-skills/[id]
 * Delete a custom skill.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const brandId = (brand as { id: string }).id;

    const { error } = await supabase
      .from("custom_skills")
      .delete()
      .eq("id", id)
      .eq("brand_id", brandId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete custom skill" },
      { status: 500 }
    );
  }
}

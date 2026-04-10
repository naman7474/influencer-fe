import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { executeCustomSkill } from "@/lib/agent/skills/custom-executor";

/**
 * POST /api/agent/custom-skills/test
 * Dry-run a custom skill with sample inputs (does not persist).
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
    const { execution_type, execution_config, test_params } = body;

    if (!execution_type || !execution_config) {
      return NextResponse.json(
        { error: "Missing execution_type or execution_config" },
        { status: 400 }
      );
    }

    const brandId = (brand as { id: string }).id;

    const result = await executeCustomSkill(
      {
        execution_type,
        execution_config,
      },
      test_params || {},
      brandId,
      supabase
    );

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

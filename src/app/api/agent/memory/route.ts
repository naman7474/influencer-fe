import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/agent/memory?tab=episodes|knowledge
 * Returns agent memory data — episodes or knowledge items.
 */
export async function GET(request: NextRequest) {
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

    const brandId = (brand as { id: string }).id;
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "knowledge";

    if (tab === "knowledge") {
      const { data, error } = await supabase
        .from("agent_knowledge")
        .select(
          "id, knowledge_type, fact, confidence, evidence_count, reinforced_count, contradicted_count, last_reinforced_at, is_active, created_at, updated_at"
        )
        .eq("brand_id", brandId)
        .eq("is_active", true)
        .order("confidence", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ knowledge: data || [] });
    }

    if (tab === "episodes") {
      const { data, error } = await supabase
        .from("agent_episodes")
        .select(
          "id, episode_type, summary, details, creator_id, campaign_id, outcome, created_at"
        )
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ episodes: data || [] });
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Failed to load memory" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const { data: messagesRow } = await supabase
      .from("agent_conversations")
      .select("id, role, content, tool_calls, page_context, created_at")
      .eq("brand_id", brand.id)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(50);
    const messages = messagesRow as Record<string, unknown>[] | null;

    return NextResponse.json({ success: true, data: messages || [] });
  } catch {
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("agent_conversations") as any)
      .delete()
      .eq("brand_id", brand.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to clear conversations" },
      { status: 500 }
    );
  }
}

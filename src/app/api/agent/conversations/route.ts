import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

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

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    let query = supabase
      .from("agent_conversations")
      .select("id, role, content, tool_calls, page_context, created_at, session_id")
      .eq("brand_id", brand.id)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(50);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data: messagesRow } = await query;
    const messages = messagesRow as Record<string, unknown>[] | null;

    return NextResponse.json({ success: true, data: messages || [] });
  } catch {
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      // Delete only messages for this session
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("agent_conversations") as any)
        .delete()
        .eq("brand_id", brand.id)
        .eq("session_id", sessionId);
    } else {
      // Delete all messages for this brand
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("agent_conversations") as any)
        .delete()
        .eq("brand_id", brand.id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to clear conversations" },
      { status: 500 }
    );
  }
}

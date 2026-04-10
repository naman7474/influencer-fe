import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

/** GET — list all sessions for the brand, newest first */
export async function GET() {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServiceRoleClient();

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as { id: string } | null;
    if (!brand)
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const { data: sessions } = await supabase
      .from("agent_chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("brand_id", brand.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ success: true, data: sessions || [] });
  } catch {
    return NextResponse.json(
      { error: "Failed to load sessions" },
      { status: 500 }
    );
  }
}

/** POST — create a new session */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServiceRoleClient();

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as { id: string } | null;
    if (!brand)
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const title = (body as Record<string, unknown>).title as string | undefined;

    const { data: session, error } = await supabase
      .from("agent_chat_sessions")
      .insert({
        brand_id: brand.id,
        title: title || "New Chat",
      } as never)
      .select()
      .single();

    if (error) {
      console.error("[sessions] Create failed:", error);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: session });
  } catch {
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

/** DELETE — delete a session and its messages (via cascade) */
export async function DELETE(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServiceRoleClient();

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as { id: string } | null;
    if (!brand)
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("agent_chat_sessions") as any)
      .delete()
      .eq("id", sessionId)
      .eq("brand_id", brand.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/messages/threads/[id]
 * Get a thread with all its messages.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;
    if (!brand) {
      return NextResponse.json(
        { error: "Brand profile not found." },
        { status: 404 }
      );
    }

    // Fetch thread with creator info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: thread, error: threadError } = await (supabase as any)
      .from("message_threads")
      .select(
        `
        *,
        creators!inner (
          id,
          handle,
          display_name,
          avatar_url,
          contact_email,
          city,
          country,
          followers,
          tier
        ),
        campaigns (
          id,
          name
        )
      `
      )
      .eq("id", threadId)
      .eq("brand_id", brand.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Thread not found." },
        { status: 404 }
      );
    }

    // Fetch all messages in the thread
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: messages, error: msgError } = await (supabase as any)
      .from("outreach_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (msgError) {
      return NextResponse.json(
        { error: "Failed to fetch messages." },
        { status: 500 }
      );
    }

    // Fetch replies linked to these messages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageIds = ((messages || []) as any[]).map((m) => m.id);
    let replies: unknown[] = [];
    if (messageIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: replyData } = await (supabase as any)
        .from("outreach_replies")
        .select("*")
        .in("outreach_message_id", messageIds)
        .order("received_at", { ascending: true });
      replies = replyData || [];
    }

    return NextResponse.json({
      thread,
      messages: messages || [],
      replies,
    });
  } catch (err) {
    console.error("Thread detail error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

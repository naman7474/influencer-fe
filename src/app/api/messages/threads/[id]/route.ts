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

    // Match score for this creator + brand. Multiple rows possible (one per
    // platform); pick the highest. match_score may be stored as 0-1 or 0-100
    // depending on pipeline run — normalize to 0-100.
    let matchScore: number | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creatorId = (thread as any)?.creators?.id;
    if (creatorId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: matches } = await (supabase as any)
        .from("creator_brand_matches")
        .select("match_score")
        .eq("brand_id", brand.id)
        .eq("creator_id", creatorId);
      for (const m of (matches ?? []) as Array<{ match_score: number | null }>) {
        if (m.match_score == null) continue;
        const raw = Number(m.match_score);
        const normalized = raw <= 1 ? raw * 100 : raw;
        if (matchScore == null || normalized > matchScore) matchScore = normalized;
      }
    }

    return NextResponse.json({
      thread: { ...(thread as object), match_score: matchScore },
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

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/messages/compose
 * Create a draft message (not yet sent).
 */
export async function POST(request: NextRequest) {
  try {
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
      .select("id, gmail_email, email_sender_name")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as {
      id: string;
      gmail_email: string | null;
      email_sender_name: string | null;
    } | null;

    if (!brand) {
      return NextResponse.json(
        { error: "Brand profile not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { creator_id, campaign_id, subject, body_html, template_id, recipient_email } =
      body as {
        creator_id: string;
        campaign_id?: string;
        subject?: string;
        body_html: string;
        template_id?: string;
        recipient_email?: string;
      };

    if (!creator_id || !body_html) {
      return NextResponse.json(
        { error: "Missing required fields: creator_id, body_html." },
        { status: 400 }
      );
    }

    // Find or create thread
    const { data: existingThreadRow } = await supabase
      .from("message_threads")
      .select("id")
      .eq("brand_id", brand.id)
      .eq("creator_id", creator_id)
      .single();

    const existingThread = existingThreadRow as { id: string } | null;

    let threadId: string;
    if (existingThread) {
      threadId = existingThread.id;
    } else {
      const { data: newThreadRow, error: threadError } = await supabase
        .from("message_threads")
        .insert({
          brand_id: brand.id,
          creator_id,
          subject: subject || null,
          campaign_id: campaign_id || null,
          outreach_status: "draft",
        } as never)
        .select("id")
        .single();

      const newThread = newThreadRow as { id: string } | null;

      if (threadError || !newThread) {
        return NextResponse.json(
          { error: "Failed to create thread." },
          { status: 500 }
        );
      }
      threadId = newThread.id;
    }

    const senderName =
      brand.email_sender_name || user.user_metadata?.full_name || "Team";

    // Insert draft message
    const { data: messageRow, error: msgError } = await supabase
      .from("outreach_messages")
      .insert({
        brand_id: brand.id,
        creator_id,
        campaign_id: campaign_id || null,
        thread_id: threadId,
        channel: "email",
        direction: "outbound",
        status: "draft",
        subject: subject || null,
        body: body_html,
        recipient_email: recipient_email || null,
        from_email: brand.gmail_email || null,
        template_id: template_id || null,
        drafted_by: "human",
        sender_name: senderName,
        sent_by_user_id: user.id,
      } as never)
      .select("id")
      .single();

    const message = messageRow as { id: string } | null;

    if (msgError || !message) {
      return NextResponse.json(
        { error: "Failed to save draft." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message_id: message.id,
      thread_id: threadId,
    });
  } catch (err) {
    console.error("Compose error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

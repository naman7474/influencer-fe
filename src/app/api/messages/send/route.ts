import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/gmail";
import { insertTrackingPixel, buildEmailHtml } from "@/lib/outreach/email-sender";
import { checkSendLimits } from "@/lib/outreach/rate-limiter";

/**
 * POST /api/messages/send
 * Send a single outreach email.
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
      .select(
        "id, brand_name, website, logo_url, gmail_connected, gmail_email, email_sender_name, email_signature, email_include_tracking, email_include_logo"
      )
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as {
      id: string;
      brand_name: string;
      website: string | null;
      logo_url: string | null;
      gmail_connected: boolean;
      gmail_email: string | null;
      email_sender_name: string | null;
      email_signature: string | null;
      email_include_tracking: boolean;
      email_include_logo: boolean;
    } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand profile not found." }, { status: 404 });
    }

    if (!brand.gmail_connected || !brand.gmail_email) {
      return NextResponse.json(
        { error: "Gmail is not connected. Please connect Gmail in Settings." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      creator_id,
      campaign_id,
      subject,
      body_html,
      template_id,
      recipient_email,
      thread_id: existingThreadId,
      reply_to_message_id,
      gmail_thread_id,
    } = body as {
      creator_id: string;
      campaign_id?: string;
      subject: string;
      body_html: string;
      template_id?: string;
      recipient_email: string;
      thread_id?: string;
      reply_to_message_id?: string;
      gmail_thread_id?: string;
    };

    if (!creator_id || !subject || !body_html || !recipient_email) {
      return NextResponse.json(
        { error: "Missing required fields: creator_id, subject, body_html, recipient_email." },
        { status: 400 }
      );
    }

    // Check rate limits
    const today = new Date().toISOString().split("T")[0];

    const { count: dailyCount } = await supabase
      .from("outreach_messages")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .gte("sent_at", `${today}T00:00:00Z`)
      .in("status", ["sent", "delivered", "opened", "replied"]);

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: minuteCount } = await supabase
      .from("outreach_messages")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .gte("sent_at", oneMinuteAgo);

    const limits = checkSendLimits({
      dailyCount: dailyCount ?? 0,
      minuteCount: minuteCount ?? 0,
    });

    if (!limits.canSend) {
      return NextResponse.json({ error: limits.reason }, { status: 429 });
    }

    // Find or create thread
    let threadId = existingThreadId;
    if (!threadId) {
      // Check for existing thread
      const { data: existingThreadRow } = await supabase
        .from("message_threads")
        .select("id")
        .eq("brand_id", brand.id)
        .eq("creator_id", creator_id)
        .single();

      const existingThread = existingThreadRow as { id: string } | null;

      if (existingThread) {
        threadId = existingThread.id;
      } else {
        const { data: newThreadRow, error: threadError } = await supabase
          .from("message_threads")
          .insert({
            brand_id: brand.id,
            creator_id,
            subject,
            campaign_id: campaign_id || null,
            outreach_status: "sent",
            last_message_direction: "outbound",
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
    }

    // Build full email HTML
    const senderName = brand.email_sender_name || user.user_metadata?.full_name || "Team";
    const fullHtml = buildEmailHtml({
      body: body_html,
      senderName,
      brandName: brand.brand_name,
      brandWebsite: brand.website,
      brandLogoUrl: brand.email_include_logo ? brand.logo_url : null,
      signature: brand.email_signature,
      creatorId: creator_id,
    });

    // Insert message as 'sending'
    const { data: messageRow, error: msgError } = await supabase
      .from("outreach_messages")
      .insert({
        brand_id: brand.id,
        creator_id,
        campaign_id: campaign_id || null,
        thread_id: threadId,
        channel: "email",
        status: "sending",
        subject,
        body: brand.email_include_tracking
          ? insertTrackingPixel(fullHtml, "PLACEHOLDER")
          : fullHtml,
        recipient_email,
        from_email: brand.gmail_email,
        template_id: template_id || null,
        drafted_by: "human",
        sender_name: senderName,
      } as never)
      .select("id")
      .single();

    const message = messageRow as { id: string } | null;

    if (msgError || !message) {
      return NextResponse.json(
        { error: "Failed to create message." },
        { status: 500 }
      );
    }

    // Now update the tracking pixel with real message ID
    if (brand.email_include_tracking) {
      const htmlWithPixel = insertTrackingPixel(fullHtml, message.id);
      await supabase
        .from("outreach_messages")
        .update({ body: htmlWithPixel } as never)
        .eq("id", message.id);
    }

    // Send via Composio Gmail
    try {
      const gmailResponse = await sendEmail(brand.id, {
        to: recipient_email,
        subject,
        body: brand.email_include_tracking
          ? insertTrackingPixel(fullHtml, message.id)
          : fullHtml,
        replyToMessageId: reply_to_message_id,
        threadId: gmail_thread_id,
      });

      // Update message with Gmail metadata
      await supabase
        .from("outreach_messages")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_message_id: gmailResponse.messageId,
          gmail_thread_id: gmailResponse.threadId,
        } as never)
        .eq("id", message.id);

      // Update thread
      await supabase
        .from("message_threads")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: body_html.replace(/<[^>]*>/g, "").substring(0, 100),
          last_message_direction: "outbound",
          outreach_status: "sent",
          campaign_id: campaign_id || null,
        } as never)
        .eq("id", threadId);

      // Advance campaign_creators status if applicable
      if (campaign_id) {
        await supabase
          .from("campaign_creators")
          .update({ status: "outreach_sent" } as never)
          .eq("campaign_id", campaign_id)
          .eq("creator_id", creator_id)
          .in("status", ["shortlisted"]);
      }

      // Increment template usage
      if (template_id) {
        await supabase.rpc("increment_template_usage", { tid: template_id } as never);
      }

      return NextResponse.json({
        success: true,
        message_id: message.id,
        thread_id: threadId,
      });
    } catch (sendError) {
      // Mark as failed
      await supabase
        .from("outreach_messages")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          error_message: sendError instanceof Error ? sendError.message : "Send failed",
        } as never)
        .eq("id", message.id);

      return NextResponse.json(
        { error: "Failed to send email via Gmail." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Send error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

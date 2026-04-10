import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/gmail";
import {
  insertTrackingPixel,
  buildEmailHtml,
} from "@/lib/outreach/email-sender";
import { checkSendLimits } from "@/lib/outreach/rate-limiter";

interface SendOutreachResult {
  success: boolean;
  message_id?: string;
  thread_id?: string;
  error?: string;
}

/**
 * Shared send logic used by both manual send (/api/messages/send)
 * and agent approval execution (/api/agent/approvals/[id]).
 *
 * Sends a draft outreach message via Gmail.
 */
export async function sendOutreachEmail(params: {
  messageId: string;
  brandId: string;
  supabase: SupabaseClient;
  draftedBy?: "human" | "agent";
}): Promise<SendOutreachResult> {
  const { messageId, brandId, supabase, draftedBy } = params;

  // 1. Load message
  const { data: message } = await supabase
    .from("outreach_messages")
    .select("*")
    .eq("id", messageId)
    .eq("brand_id", brandId)
    .single();

  if (!message) return { success: false, error: "Message not found" };

  // 2. Load brand
  const { data: brand } = await supabase
    .from("brands")
    .select(
      "id, brand_name, website, logo_url, gmail_connected, gmail_email, email_sender_name, email_signature, email_include_tracking, email_include_logo"
    )
    .eq("id", brandId)
    .single();

  if (!brand || !brand.gmail_connected || !brand.gmail_email) {
    return { success: false, error: "Gmail not connected" };
  }

  // 3. Check rate limits
  const today = new Date().toISOString().split("T")[0];
  const { count: dailyCount } = await supabase
    .from("outreach_messages")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .gte("sent_at", `${today}T00:00:00Z`)
    .in("status", ["sent", "delivered", "opened", "replied"]);

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: minuteCount } = await supabase
    .from("outreach_messages")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .gte("sent_at", oneMinuteAgo);

  const limits = checkSendLimits({
    dailyCount: dailyCount ?? 0,
    minuteCount: minuteCount ?? 0,
  });

  if (!limits.canSend) {
    return { success: false, error: limits.reason };
  }

  // 4. Find or create thread
  let threadId = message.thread_id;
  if (!threadId) {
    const { data: existingThread } = await supabase
      .from("message_threads")
      .select("id")
      .eq("brand_id", brandId)
      .eq("creator_id", message.creator_id)
      .single();

    if (existingThread) {
      threadId = existingThread.id;
    } else {
      const { data: newThread } = await supabase
        .from("message_threads")
        .insert({
          brand_id: brandId,
          creator_id: message.creator_id,
          subject: message.subject,
          campaign_id: message.campaign_id || null,
          outreach_status: "sent",
          last_message_direction: "outbound",
          last_message_at: new Date().toISOString(),
        } as never)
        .select("id")
        .single();

      if (!newThread) {
        return { success: false, error: "Failed to create thread" };
      }
      threadId = (newThread as { id: string }).id;
    }
  }

  // 5. Build HTML
  const senderName =
    brand.email_sender_name || brand.brand_name;
  const fullHtml = buildEmailHtml({
    body: message.body,
    senderName,
    brandName: brand.brand_name,
    brandWebsite: brand.website,
    brandLogoUrl: brand.email_include_logo ? brand.logo_url : null,
    signature: brand.email_signature,
    creatorId: message.creator_id,
  });

  // 6. Link message to thread and set drafted_by
  await supabase
    .from("outreach_messages")
    .update({
      thread_id: threadId,
      drafted_by: draftedBy || message.drafted_by || "human",
    } as never)
    .eq("id", messageId);

  // Add tracking pixel
  const htmlToSend = brand.email_include_tracking
    ? insertTrackingPixel(fullHtml, messageId)
    : fullHtml;

  if (brand.email_include_tracking) {
    await supabase
      .from("outreach_messages")
      .update({ body: htmlToSend } as never)
      .eq("id", messageId);
  }

  // 7. Send via Gmail
  try {
    const gmailResponse = await sendEmail(brandId, {
      to: message.recipient_email,
      subject: message.subject,
      body: htmlToSend,
    });

    // 8. Update message with Gmail metadata
    await supabase
      .from("outreach_messages")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        thread_id: threadId,
        resend_message_id: gmailResponse.messageId,
        gmail_thread_id: gmailResponse.threadId,
      } as never)
      .eq("id", messageId);

    // 9. Update thread
    await supabase
      .from("message_threads")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.body
          .replace(/<[^>]*>/g, "")
          .substring(0, 100),
        last_message_direction: "outbound",
        outreach_status: "sent",
        campaign_id: message.campaign_id || null,
      } as never)
      .eq("id", threadId);

    // 10. Advance campaign_creators status
    if (message.campaign_id) {
      await supabase
        .from("campaign_creators")
        .update({ status: "outreach_sent" } as never)
        .eq("campaign_id", message.campaign_id)
        .eq("creator_id", message.creator_id)
        .in("status", ["shortlisted"]);
    }

    // 11. Increment template usage
    if (message.template_id) {
      await supabase.rpc("increment_template_usage", {
        tid: message.template_id,
      } as never);
    }

    return {
      success: true,
      message_id: messageId,
      thread_id: threadId,
    };
  } catch (sendError) {
    await supabase
      .from("outreach_messages")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message:
          sendError instanceof Error ? sendError.message : "Send failed",
      } as never)
      .eq("id", messageId);

    return { success: false, error: "Failed to send email via Gmail" };
  }
}

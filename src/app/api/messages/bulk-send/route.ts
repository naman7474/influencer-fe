import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/gmail";
import { insertTrackingPixel, buildEmailHtml, stripHtml } from "@/lib/outreach/email-sender";
import { checkSendLimits } from "@/lib/outreach/rate-limiter";

interface BulkRecipient {
  creator_id: string;
  recipient_email: string;
  subject: string;
  body_html: string;
  template_id?: string;
}

/**
 * POST /api/messages/bulk-send
 * Send personalized outreach emails to multiple creators.
 * Emails are sent sequentially with 1-second delays.
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
        { error: "Gmail is not connected." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { campaign_id, recipients } = body as {
      campaign_id?: string;
      recipients: BulkRecipient[];
    };

    if (!recipients?.length) {
      return NextResponse.json(
        { error: "No recipients provided." },
        { status: 400 }
      );
    }

    const senderName = brand.email_sender_name || user.user_metadata?.full_name || "Team";
    const results: Array<{
      creator_id: string;
      status: "sent" | "failed" | "rate_limited" | "skipped";
      message_id?: string;
      reason?: string;
    }> = [];

    for (const recipient of recipients) {
      // Check rate limits before each send
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
        results.push({
          creator_id: recipient.creator_id,
          status: "rate_limited",
          reason: limits.reason,
        });
        continue;
      }

      if (!recipient.recipient_email) {
        results.push({
          creator_id: recipient.creator_id,
          status: "skipped",
          reason: "No email address",
        });
        continue;
      }

      try {
        // Find or create thread. Use maybeSingle() so a missing row returns
        // null cleanly (instead of PGRST116). On a fresh creator, insert a
        // new thread; if a parallel insert raced us and tripped the unique
        // (brand_id, creator_id) constraint, re-select the winner.
        const { data: existingThreadRow, error: existingErr } = await supabase
          .from("message_threads")
          .select("id")
          .eq("brand_id", brand.id)
          .eq("creator_id", recipient.creator_id)
          .maybeSingle();

        if (existingErr) {
          console.error("bulk-send thread lookup error:", existingErr);
          results.push({
            creator_id: recipient.creator_id,
            status: "failed",
            reason: `Thread lookup: ${existingErr.message}`,
          });
          continue;
        }

        let threadId = (existingThreadRow as { id: string } | null)?.id ?? "";

        if (!threadId) {
          const nowIso = new Date().toISOString();
          const { data: newThreadRow, error: newThreadErr } = await supabase
            .from("message_threads")
            .insert({
              brand_id: brand.id,
              creator_id: recipient.creator_id,
              subject: recipient.subject,
              campaign_id: campaign_id || null,
              outreach_status: "sent",
              last_message_direction: "outbound",
              last_message_channel: "email",
              last_message_at: nowIso,
            } as never)
            .select("id")
            .maybeSingle();

          if (newThreadErr) {
            // Unique-constraint race: another request just created the
            // thread. Re-select and use that id.
            if (newThreadErr.code === "23505") {
              const { data: race } = await supabase
                .from("message_threads")
                .select("id")
                .eq("brand_id", brand.id)
                .eq("creator_id", recipient.creator_id)
                .maybeSingle();
              threadId = (race as { id: string } | null)?.id ?? "";
            }
            if (!threadId) {
              console.error("bulk-send thread insert error:", newThreadErr);
              results.push({
                creator_id: recipient.creator_id,
                status: "failed",
                reason: `Thread create: ${newThreadErr.message}`,
              });
              continue;
            }
          } else {
            threadId = (newThreadRow as { id: string } | null)?.id ?? "";
          }
        }

        if (!threadId) {
          results.push({
            creator_id: recipient.creator_id,
            status: "failed",
            reason: "Could not resolve thread id",
          });
          continue;
        }

        // Build email HTML
        const fullHtml = buildEmailHtml({
          body: recipient.body_html,
          senderName,
          brandName: brand.brand_name,
          brandWebsite: brand.website,
          brandLogoUrl: brand.email_include_logo ? brand.logo_url : null,
          signature: brand.email_signature,
          creatorId: recipient.creator_id,
        });

        // Insert message
        const { data: messageRow, error: messageErr } = await supabase
          .from("outreach_messages")
          .insert({
            brand_id: brand.id,
            creator_id: recipient.creator_id,
            campaign_id: campaign_id || null,
            thread_id: threadId,
            channel: "email",
            direction: "outbound",
            status: "sending",
            subject: recipient.subject,
            body: fullHtml,
            recipient_email: recipient.recipient_email,
            from_email: brand.gmail_email,
            template_id: recipient.template_id || null,
            drafted_by: "human",
            sender_name: senderName,
            sent_by_user_id: user.id,
          } as never)
          .select("id")
          .maybeSingle();

        const message = messageRow as { id: string } | null;

        if (messageErr || !message) {
          if (messageErr) {
            console.error("bulk-send message insert error:", messageErr);
          }
          results.push({
            creator_id: recipient.creator_id,
            status: "failed",
            reason: messageErr
              ? `Message: ${messageErr.message}`
              : "Failed to create message",
          });
          continue;
        }

        // Add tracking pixel with real message ID
        const htmlWithPixel = brand.email_include_tracking
          ? insertTrackingPixel(fullHtml, message.id)
          : fullHtml;

        // Send via Composio
        const gmailResponse = await sendEmail(brand.id, {
          to: recipient.recipient_email,
          subject: recipient.subject,
          body: htmlWithPixel,
        });

        // Update message with sent status
        await supabase
          .from("outreach_messages")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            body: htmlWithPixel,
            resend_message_id: gmailResponse.messageId,
            gmail_thread_id: gmailResponse.threadId,
          } as never)
          .eq("id", message.id);

        // Update thread
        await supabase
          .from("message_threads")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: stripHtml(recipient.body_html).substring(0, 100),
            last_message_direction: "outbound",
            last_message_channel: "email",
            outreach_status: "sent",
          } as never)
          .eq("id", threadId);

        // Advance campaign status
        if (campaign_id) {
          await supabase
            .from("campaign_creators")
            .update({ status: "outreach_sent" } as never)
            .eq("campaign_id", campaign_id)
            .eq("creator_id", recipient.creator_id)
            .in("status", ["shortlisted"]);
        }

        // Increment template usage
        if (recipient.template_id) {
          await supabase.rpc("increment_template_usage", {
            tid: recipient.template_id,
          } as never);
        }

        results.push({
          creator_id: recipient.creator_id,
          status: "sent",
          message_id: message.id,
        });
      } catch (sendError) {
        results.push({
          creator_id: recipient.creator_id,
          status: "failed",
          reason: sendError instanceof Error ? sendError.message : "Send failed",
        });
      }

      // 1-second delay between sends
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const rateLimited = results.filter((r) => r.status === "rate_limited").length;

    return NextResponse.json({
      success: true,
      summary: { total: recipients.length, sent, failed, skipped, rate_limited: rateLimited },
      results,
    });
  } catch (err) {
    console.error("Bulk send error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

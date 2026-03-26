import { apiError, apiOk } from "@/lib/api";
import { recordOutreachEvent } from "@/lib/mutations/outreach";
import {
  extractReplyMessageId,
  getSvixHeaders,
  verifySvixSignature,
} from "@/lib/resend";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}

export async function POST(request: Request) {
  try {
    const payloadText = await request.text();
    const headers = getSvixHeaders(request.headers);

    if (!verifySvixSignature(payloadText, headers)) {
      return apiError(401, {
        code: "invalid_signature",
        message: "Invalid Resend webhook signature.",
      });
    }

    const payload = JSON.parse(payloadText) as {
      type?: string;
      data?: Record<string, unknown>;
    };
    const eventType = payload.type ?? "";
    const data = payload.data ?? {};
    const serviceRole = createServiceRoleClient();

    if (
      eventType === "email.sent" ||
      eventType === "email.delivered" ||
      eventType === "email.opened" ||
      eventType === "email.bounced"
    ) {
      const statusMap = {
        "email.sent": "sent",
        "email.delivered": "delivered",
        "email.opened": "opened",
        "email.bounced": "bounced",
      } as const;

      const resendMessageId =
        String(data.email_id ?? data.id ?? data["message_id"] ?? "");

      if (!resendMessageId) {
        return apiOk({ ignored: true });
      }

      await recordOutreachEvent(serviceRole, {
        resend_message_id: resendMessageId,
        status: statusMap[eventType],
        timestamp: String(data.created_at ?? data.timestamp ?? new Date().toISOString()),
        error_message: typeof data.reason === "string" ? data.reason : null,
      });

      return apiOk({ received: true });
    }

    if (
      eventType === "email.received" ||
      eventType === "email.reply" ||
      eventType === "inbound_email.received"
    ) {
      const replyAddress = extractReplyMessageId(
        toArray(data.to ?? data["to_email"] ?? data["recipient"])
      );

      if (!replyAddress) {
        return apiOk({ ignored: true });
      }

      const { data: message, error: messageError } = await serviceRole
        .from("outreach_messages")
        .select("*")
        .eq("id", replyAddress)
        .maybeSingle();

      if (messageError) {
        throw messageError;
      }

      if (!message) {
        return apiOk({ ignored: true });
      }

      const insertedReply = await serviceRole
        .from("outreach_replies")
        .insert({
          brand_id: message.brand_id,
          outreach_message_id: message.id,
          resend_message_id: data.email_id ?? data.id ?? null,
          from_email: toArray(data.from ?? data["from_email"])[0] ?? null,
          to_email: toArray(data.to ?? data["to_email"])[0] ?? null,
          subject: data.subject ?? null,
          text_content: data.text ?? data.text_content ?? null,
          html_content: data.html ?? data.html_content ?? null,
          raw_payload: payload,
          received_at: data.created_at ?? new Date().toISOString(),
        })
        .select("*")
        .single();

      if (insertedReply.error) {
        throw insertedReply.error;
      }

      await recordOutreachEvent(serviceRole, {
        outreach_message_id: message.id,
        status: "replied",
        timestamp: String(data.created_at ?? new Date().toISOString()),
      });

      return apiOk({ reply: insertedReply.data });
    }

    return apiOk({ ignored: true });
  } catch (error) {
    return apiError(500, {
      code: "resend_webhook_failed",
      message:
        error instanceof Error ? error.message : "Unable to process Resend webhook.",
    });
  }
}

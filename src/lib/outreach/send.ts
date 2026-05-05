import { sendEmail } from "@/lib/gmail";
import { sendInstagramDm } from "@/lib/instagram/send-dm";

export type OutreachChannel = "email" | "instagram_dm";

export type SendArgs =
  | {
      channel: "email";
      brandId: string;
      to: string;
      subject: string;
      body: string;
      replyToMessageId?: string;
      threadId?: string;
    }
  | {
      channel: "instagram_dm";
      brandId: string;
      to: string;       // IG-scoped recipient id (PSID)
      body: string;
    };

export type SendResult =
  | { ok: true; provider_message_id: string; provider_thread_id?: string }
  | { ok: false; error: string };

/**
 * Channel-aware send dispatcher. Existing email send path preserved
 * verbatim; Instagram routes to send-dm.ts.
 */
export async function sendOutreachMessage(args: SendArgs): Promise<SendResult> {
  switch (args.channel) {
    case "email": {
      try {
        const r = await sendEmail(args.brandId, {
          to: args.to,
          subject: args.subject,
          body: args.body,
          replyToMessageId: args.replyToMessageId,
          threadId: args.threadId,
        });
        return {
          ok: true,
          provider_message_id: r.messageId,
          provider_thread_id: r.threadId,
        };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }
    case "instagram_dm": {
      const r = await sendInstagramDm({
        brandId: args.brandId,
        recipientId: args.to,
        body: args.body,
      });
      if (r.ok) return { ok: true, provider_message_id: r.provider_message_id };
      const reason =
        r.reason === "personal_token_kind_unsupported"
          ? `personal_token_kind_unsupported:${(r as { kind?: string }).kind ?? ""}`
          : r.reason === "graph_error"
          ? r.message
          : r.reason;
      return { ok: false, error: reason };
    }
  }
}

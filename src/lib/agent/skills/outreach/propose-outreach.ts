import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function proposeOutreachTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to submit a drafted outreach email for approval. This tool creates an approval_queue entry in the database — without calling it, no approval is created. Always call this after outreach_drafter to submit for sending approval.",
    inputSchema: z.object({
      message_id: z
        .string()
        .describe(
          "The outreach_messages UUID of the draft to propose for sending"
        ),
      reasoning: z
        .string()
        .optional()
        .describe(
          "Why the agent recommends sending this outreach (e.g. strong match score, warm lead)"
        ),
    }),
    execute: async (params) => {
      // 1. Load the draft message
      const { data: messageRaw } = await supabase
        .from("outreach_messages")
        .select("id, creator_id, campaign_id, subject, body, recipient_email, status")
        .eq("id", params.message_id)
        .eq("brand_id", brandId)
        .single();
      const message = messageRaw as Record<string, unknown> | null;

      if (!message) return { error: "Draft message not found" };
      if (message.status !== "draft") {
        return { error: `Message is in '${message.status}' status, not 'draft'` };
      }

      // Get creator handle for display
      let creatorHandle = "creator";
      if (message.creator_id) {
        const { data: creatorRaw } = await supabase
          .from("creators")
          .select("handle")
          .eq("id", message.creator_id)
          .single();
        const creator = creatorRaw as Record<string, unknown> | null;
        if (creator) creatorHandle = creator.handle as string;
      }

      // 2. Create approval queue item
      const { data: approvalRaw, error } = await supabase
        .from("approval_queue")
        .insert({
          brand_id: brandId,
          action_type: "send_outreach",
          status: "pending",
          payload: {
            message_id: message.id,
            recipient_email: message.recipient_email,
            subject: message.subject,
            body_preview: ((message.body as string) || "").substring(0, 300),
          },
          title: `Send outreach to @${creatorHandle}`,
          description: `Subject: ${message.subject}\n\nTo: ${message.recipient_email}`,
          reasoning:
            params.reasoning ||
            "Agent-drafted outreach based on creator intelligence and brand context.",
          creator_id: message.creator_id,
          campaign_id: message.campaign_id,
          message_id: message.id,
        } as never)
        .select("id")
        .single();
      const approval = approvalRaw as Record<string, unknown> | null;

      if (error) {
        return { error: `Failed to create approval: ${error.message}` };
      }

      // 3. Create notification for brand manager
      await supabase.from("notifications").insert({
        brand_id: brandId,
        type: "approval_pending",
        title: "Outreach draft ready for review",
        body: `Review and approve outreach to @${creatorHandle}`,
        link: "/approvals",
        metadata: { approval_id: approval!.id },
      } as never);

      return {
        approval_id: approval!.id,
        status: "pending",
        message: `Outreach draft to @${creatorHandle} has been submitted for your approval. You can review it in the Approvals section or approve it here.`,
        creator_handle: creatorHandle,
        subject: message.subject,
      };
    },
  });
}

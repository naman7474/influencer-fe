/* ------------------------------------------------------------------ */
/*  Approval Wrapper                                                   */
/*  Generalized approval queue insertion for any high-risk skill      */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";

interface ApprovalRequest {
  brandId: string;
  actionType: string;
  title: string;
  description: string;
  reasoning: string;
  payload: Record<string, unknown>;
  creatorId?: string | null;
  campaignId?: string | null;
  messageId?: string | null;
}

interface ApprovalResult {
  approval_id: string;
  status: "pending";
  message: string;
}

/**
 * Create an approval queue item and notify the brand manager.
 * Generalizes the pattern from propose-outreach.ts for any action type.
 */
export async function createApprovalRequest(
  supabase: SupabaseClient,
  request: ApprovalRequest
): Promise<ApprovalResult | { error: string }> {
  const { data: approvalRaw, error } = await supabase
    .from("approval_queue")
    .insert({
      brand_id: request.brandId,
      action_type: request.actionType,
      status: "pending",
      title: request.title,
      description: request.description,
      reasoning: request.reasoning,
      payload: request.payload,
      creator_id: request.creatorId || null,
      campaign_id: request.campaignId || null,
      message_id: request.messageId || null,
    } as never)
    .select("id")
    .single();

  const approval = approvalRaw as Record<string, unknown> | null;

  if (error) {
    return { error: `Failed to create approval: ${error.message}` };
  }

  // Create notification for brand manager
  await supabase.from("notifications").insert({
    brand_id: request.brandId,
    type: "approval_pending",
    title: request.title,
    body: request.description,
    link: "/approvals",
    metadata: { approval_id: approval!.id },
  } as never);

  return {
    approval_id: approval!.id as string,
    status: "pending" as const,
    message: `Action submitted for approval: ${request.title}. Review it in the Approvals section.`,
  };
}

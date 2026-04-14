import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendOutreachEmail } from "@/lib/outreach/send-email";
import { writeEpisode } from "@/lib/agent/memory/episode-writer";

/**
 * POST /api/agent/outreach/approve-send
 *
 * One-click "Approve & Send" for an agent-drafted outreach message.
 * Creates an approval-queue entry (audit trail), auto-approves it,
 * and sends the email via Gmail.
 *
 * Body: { draft_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const { draft_id } = await request.json();
    if (!draft_id || typeof draft_id !== "string") {
      return NextResponse.json(
        { error: "Missing draft_id" },
        { status: 400 }
      );
    }

    // 1. Load the draft message
    const { data: msgRaw } = await supabase
      .from("outreach_messages")
      .select("id, creator_id, campaign_id, subject, body, recipient_email, status")
      .eq("id", draft_id)
      .eq("brand_id", brand.id)
      .single();
    const msg = msgRaw as Record<string, unknown> | null;

    if (!msg) {
      return NextResponse.json(
        { error: "Draft message not found" },
        { status: 404 }
      );
    }
    if (msg.status !== "draft") {
      return NextResponse.json(
        { error: `Message is already '${msg.status}', not draft` },
        { status: 400 }
      );
    }

    // 2. Get creator handle for display
    let creatorHandle = "creator";
    if (msg.creator_id) {
      const { data: cRow } = await supabase
        .from("creators")
        .select("handle")
        .eq("id", msg.creator_id)
        .single();
      if (cRow) creatorHandle = (cRow as Record<string, unknown>).handle as string;
    }

    // 3. Create approval entry (audit trail)
    const { data: approvalRaw } = await supabase
      .from("approval_queue")
      .insert({
        brand_id: brand.id,
        action_type: "send_outreach",
        status: "approved",
        payload: {
          message_id: msg.id,
          recipient_email: msg.recipient_email,
          subject: msg.subject,
          body_preview: ((msg.body as string) || "").substring(0, 300),
        },
        title: `Send outreach to @${creatorHandle}`,
        description: `Subject: ${msg.subject}\n\nTo: ${msg.recipient_email}`,
        reasoning: "Approved directly from Actions panel.",
        creator_id: msg.creator_id,
        campaign_id: msg.campaign_id,
        message_id: msg.id,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();
    const approval = approvalRaw as { id: string } | null;

    // 4. Send the email
    const result = await sendOutreachEmail({
      messageId: draft_id,
      brandId: brand.id,
      supabase,
      draftedBy: "agent",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send" },
        { status: 500 }
      );
    }

    // 5. Write episode for agent learning
    await writeEpisode({
      brandId: brand.id,
      type: "outreach_approved",
      summary: `Outreach to @${creatorHandle} approved and sent directly from Actions panel. Subject: "${msg.subject}"`,
      creatorId: (msg.creator_id as string) || undefined,
      campaignId: (msg.campaign_id as string) || undefined,
      outcome: "positive",
      supabase,
    });

    return NextResponse.json({
      success: true,
      approval_id: approval?.id ?? null,
      message_id: draft_id,
      thread_id: result.thread_id,
    });
  } catch (err) {
    console.error("[outreach/approve-send] Error:", err);
    return NextResponse.json(
      { error: "Failed to approve and send" },
      { status: 500 }
    );
  }
}

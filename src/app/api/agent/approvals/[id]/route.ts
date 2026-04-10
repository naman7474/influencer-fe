import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendOutreachEmail } from "@/lib/outreach/send-email";
import { writeEpisode } from "@/lib/agent/memory/episode-writer";
import type { ApprovalQueueItem } from "@/lib/types/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: approvalId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Load approval item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: approvalData } = await (supabase
      .from("approval_queue") as any)
      .select("*")
      .eq("id", approvalId)
      .eq("brand_id", brand.id)
      .single();
    const approval = approvalData as ApprovalQueueItem | null;

    if (!approval) {
      return NextResponse.json(
        { error: "Approval item not found" },
        { status: 404 }
      );
    }

    if (approval.status !== "pending") {
      return NextResponse.json(
        { error: `This item is already ${approval.status}` },
        { status: 400 }
      );
    }

    const { action, reason } = await request.json();

    if (action === "approve") {
      // Update approval status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase
        .from("approval_queue") as any)
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", approvalId);

      // Execute the action based on type
      const payload = (approval.payload || {}) as Record<string, unknown>;

      if (approval.action_type === "send_outreach" && approval.message_id) {
        const result = await sendOutreachEmail({
          messageId: approval.message_id,
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

        await writeEpisode({
          brandId: brand.id,
          type: "outreach_approved",
          summary: `Outreach to creator approved and sent. Subject: "${payload?.subject || "N/A"}"`,
          creatorId: approval.creator_id || undefined,
          campaignId: approval.campaign_id || undefined,
          outcome: "positive",
          supabase,
        });

        await supabase.from("notifications").insert({
          brand_id: brand.id,
          type: "outreach_sent",
          title: "Outreach sent",
          body: `Outreach to ${approval.title?.replace("Send outreach to ", "") || "creator"} was sent successfully.`,
          link: "/outreach",
        } as never);

        return NextResponse.json({
          success: true,
          action: "approved",
          message_id: approval.message_id,
          thread_id: result.thread_id,
        });
      }

      // Create campaign
      if (approval.action_type === "create_campaign") {
        const { data: newCampaign } = await supabase
          .from("campaigns")
          .insert({
            brand_id: brand.id,
            name: payload.name,
            goal: payload.goal,
            budget: payload.budget,
            start_date: payload.start_date,
            end_date: payload.end_date,
            discount_percent: payload.discount_percent || 15,
            brief_requirements: payload.brief_requirements || [],
            status: "draft",
          } as never)
          .select("id")
          .single();

        // Add pre-selected creators if any
        const creatorIds = (payload.creator_ids as string[]) || [];
        if (newCampaign && creatorIds.length > 0) {
          const ccInserts = creatorIds.map((cid) => ({
            campaign_id: (newCampaign as Record<string, unknown>).id,
            creator_id: cid,
            brand_id: brand.id,
            status: "shortlisted",
          }));
          await supabase.from("campaign_creators").insert(ccInserts as never);
        }

        await writeEpisode({
          brandId: brand.id,
          type: "campaign_created",
          summary: `Campaign "${payload.name}" created via agent`,
          campaignId: newCampaign
            ? ((newCampaign as Record<string, unknown>).id as string)
            : undefined,
          outcome: "positive",
          supabase,
        });

        return NextResponse.json({
          success: true,
          action: "approved",
          campaign_id: newCampaign
            ? (newCampaign as Record<string, unknown>).id
            : null,
        });
      }

      // Negotiate counter / accept rate
      if (
        approval.action_type === "negotiate_counter" ||
        approval.action_type === "accept_rate"
      ) {
        const ccId = payload.campaign_creator_id as string | undefined;
        const amount = payload.amount as number | undefined;

        if (ccId && amount) {
          await supabase
            .from("campaign_creators")
            .update({ agreed_rate: amount } as never)
            .eq("id", ccId);
        }

        if (payload.negotiation_id) {
          await supabase
            .from("negotiations")
            .update({
              status: approval.action_type === "accept_rate" ? "accepted" : "active",
              action_taken:
                approval.action_type === "accept_rate"
                  ? "accept"
                  : "agent_counter",
              counter_amount: amount,
            } as never)
            .eq("id", payload.negotiation_id);
        }

        await writeEpisode({
          brandId: brand.id,
          type: "negotiation_completed",
          summary: `${approval.action_type === "accept_rate" ? "Accepted" : "Countered"} rate for creator. Amount: ₹${amount?.toLocaleString("en-IN")}`,
          creatorId: approval.creator_id || undefined,
          campaignId: approval.campaign_id || undefined,
          outcome: "positive",
          supabase,
        });

        return NextResponse.json({ success: true, action: "approved" });
      }

      // Gifting order
      if (approval.action_type === "gifting_order") {
        const { data: giftOrder } = await supabase
          .from("gifting_orders")
          .insert({
            campaign_id: payload.campaign_id,
            creator_id: payload.creator_id,
            brand_id: brand.id,
            product_title: payload.product_title,
            variant_id: payload.variant_id || null,
            retail_value: payload.retail_value || null,
            note: payload.note || null,
            status: "address_requested",
          } as never)
          .select("id")
          .single();

        await writeEpisode({
          brandId: brand.id,
          type: "gifting_initiated",
          summary: `Gifting order for "${payload.product_title}" to ${payload.creator_handle || "creator"} created`,
          creatorId: (payload.creator_id as string) || undefined,
          campaignId: (payload.campaign_id as string) || undefined,
          outcome: "positive",
          supabase,
        });

        return NextResponse.json({
          success: true,
          action: "approved",
          gifting_order_id: giftOrder
            ? (giftOrder as Record<string, unknown>).id
            : null,
        });
      }

      // Generic approve (discount codes, etc.) — just mark approved
      return NextResponse.json({ success: true, action: "approved" });
    } else if (action === "reject") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase
        .from("approval_queue") as any)
        .update({
          status: "rejected",
          rejected_reason: reason || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", approvalId);

      // Write episode: action rejected (agent learns from this)
      const rejectEpisodeType =
        approval.action_type === "send_outreach"
          ? "outreach_rejected"
          : "approval_rejected";
      await writeEpisode({
        brandId: brand.id,
        type: rejectEpisodeType,
        summary: `${approval.action_type} rejected. Reason: ${reason || "No reason provided"}. Title: "${approval.title || "N/A"}"`,
        details: {
          rejection_reason: reason,
          action_type: approval.action_type,
        },
        creatorId: approval.creator_id || undefined,
        campaignId: approval.campaign_id || undefined,
        outcome: "negative",
        supabase,
      });

      return NextResponse.json({ success: true, action: "rejected" });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "approve" or "reject".' },
      { status: 400 }
    );
  } catch (err) {
    console.error("[approvals/[id]] Error:", err);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}

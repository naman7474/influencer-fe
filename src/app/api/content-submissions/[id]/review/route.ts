import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * PUT /api/content-submissions/[id]/review
 * Approve, reject, or request revision on a content submission.
 * Body: { action: "approve" | "reject" | "revision_requested", feedback?: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: submissionId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { action, feedback } = body;

    if (!["approve", "reject", "revision_requested"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action." },
        { status: 400 }
      );
    }

    const statusMap: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      revision_requested: "revision_requested",
    };

    const contentStatusMap: Record<string, string> = {
      approve: "approved",
      reject: "submitted", // Reset to submitted
      revision_requested: "revision_requested",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("content_submissions")
      .update({
        status: statusMap[action],
        feedback: feedback || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", submissionId);

    if (updateError) {
      console.error("Update submission error:", updateError);
      return NextResponse.json(
        { error: "Failed to update submission." },
        { status: 500 }
      );
    }

    // Get submission to update campaign_creator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: submission } = await (supabase as any)
      .from("content_submissions")
      .select("campaign_creator_id")
      .eq("id", submissionId)
      .single();

    if (submission) {
      await supabase
        .from("campaign_creators")
        .update({
          content_status: contentStatusMap[action],
        } as never)
        .eq("id", submission.campaign_creator_id);
    }

    return NextResponse.json({ success: true, status: statusMap[action] });
  } catch (err) {
    console.error("PUT content review error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

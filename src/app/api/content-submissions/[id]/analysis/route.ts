import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

/**
 * GET /api/content-submissions/[id]/analysis
 * Fetch the content analysis for a submission.
 */
export async function GET(
  _request: NextRequest,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: analysis, error } = await (supabase as any)
      .from("content_analyses")
      .select("*")
      .eq("content_submission_id", submissionId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Fetch analysis error:", error);
      return NextResponse.json(
        { error: "Failed to fetch analysis." },
        { status: 500 }
      );
    }

    if (!analysis) {
      return NextResponse.json({ analysis: null, status: "pending" });
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("GET analysis error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content-submissions/[id]/analysis
 * Re-trigger analysis for a submission.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: submissionId } = await params;
    const supabase = await createServerSupabaseClient();
    const service = getServiceClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Get submission details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: submission } = await (service as any)
      .from("content_submissions")
      .select("id, campaign_id, creator_id, content_url")
      .eq("id", submissionId)
      .single();

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 }
      );
    }

    // Get campaign brand_id
    const { data: campaign } = await service
      .from("campaigns")
      .select("brand_id")
      .eq("id", (submission as { campaign_id: string }).campaign_id)
      .single();

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 }
      );
    }

    // Reset existing analysis if present
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any)
      .from("content_analyses")
      .delete()
      .eq("content_submission_id", submissionId);

    // Reset submission analysis status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any)
      .from("content_submissions")
      .update({ analysis_status: "pending" })
      .eq("id", submissionId);

    // Enqueue new analysis job
    const workerUrl = process.env.PIPELINE_WORKER_URL;
    const workerSecret = process.env.PIPELINE_WORKER_SECRET;

    if (!workerUrl || !workerSecret) {
      return NextResponse.json(
        { error: "Pipeline worker not configured." },
        { status: 503 }
      );
    }

    const sub = submission as {
      id: string;
      campaign_id: string;
      creator_id: string;
      content_url: string | null;
    };

    await fetch(`${workerUrl.replace(/\/$/, "")}/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": workerSecret,
      },
      body: JSON.stringify({
        job_type: "content_video_analysis",
        brand_id: (campaign as { brand_id: string }).brand_id,
        payload: {
          content_submission_id: sub.id,
          content_url: sub.content_url,
          campaign_id: sub.campaign_id,
          creator_id: sub.creator_id,
        },
      }),
    });

    return NextResponse.json({ success: true, message: "Analysis re-triggered." });
  } catch (err) {
    console.error("POST re-analyze error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

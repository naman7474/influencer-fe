import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/campaigns/[id]/content
 * List all content submissions for a campaign.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: submissions, error } = await (supabase as any)
      .from("content_submissions")
      .select("*, content_analyses(status, overall_score, hook_strength_score, brand_mention_score, brief_compliance_score, guideline_compliance_score, analysis)")
      .eq("campaign_id", campaignId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Fetch content submissions error:", error);
      return NextResponse.json(
        { error: "Failed to fetch content submissions." },
        { status: 500 }
      );
    }

    return NextResponse.json({ submissions: submissions ?? [] });
  } catch (err) {
    console.error("GET content error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

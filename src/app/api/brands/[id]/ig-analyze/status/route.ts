import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

type Phase =
  | "queued"
  | "scraping_brand"
  | "extracting_collaborators"
  | "scoring_creators"
  | "ranking"
  | "complete"
  | "failed";

/**
 * GET /api/brands/[id]/ig-analyze/status
 *
 * Phase derivation (server-authoritative):
 *   failed                    → brands.ig_analysis_status = 'failed'
 *   queued                    → brands.ig_analysis_status = 'queued' or 'none'
 *   scraping_brand            → brands.ig_analysis_status = 'running'
 *   extracting_collaborators  → brand completed BUT zero creator_ig_scrape siblings yet
 *   scoring_creators          → creator jobs in queued/running
 *   ranking                   → all creator jobs terminal, matches not yet written (post-fanout, pre-recompute)
 *   complete                  → creator_brand_matches rows exist with used_ig_signals=true for this brand
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: brandId } = await params;

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
      .select(
        "id, instagram_handle, ig_analysis_status, ig_analysis_error, ig_collaborators"
      )
      .eq("id", brandId)
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as
      | {
          id: string;
          instagram_handle: string | null;
          ig_analysis_status: string;
          ig_analysis_error: string | null;
          ig_collaborators: string[] | null;
        }
      | null;
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const collaborators = brand.ig_collaborators ?? [];
    const collaboratorsCount = collaborators.length;

    // Creator fanout state
    const { data: creatorJobsData } = await supabase
      .from("background_jobs")
      .select("id, status")
      .eq("brand_id", brandId)
      .eq("job_type", "creator_ig_scrape");
    const creatorJobList =
      (creatorJobsData as { id: string; status: string }[] | null) ?? [];
    const totalFanout = creatorJobList.length;
    const doneFanout = creatorJobList.filter(
      (j) => j.status === "succeeded" || j.status === "failed"
    ).length;
    const allFanoutTerminal = totalFanout > 0 && doneFanout === totalFanout;

    // Matches ready?
    const { count: matchCount } = await supabase
      .from("creator_brand_matches")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("used_ig_signals", true);

    let phase: Phase = "queued";
    let progress = 0;

    if (brand.ig_analysis_status === "failed") {
      phase = "failed";
      progress = 0;
    } else if ((matchCount ?? 0) > 0) {
      phase = "complete";
      progress = 100;
    } else if (brand.ig_analysis_status === "completed" && allFanoutTerminal) {
      phase = "ranking";
      progress = 95;
    } else if (brand.ig_analysis_status === "completed" && totalFanout > 0) {
      phase = "scoring_creators";
      progress = 40 + Math.round((doneFanout / totalFanout) * 50);
    } else if (brand.ig_analysis_status === "completed" && totalFanout === 0) {
      phase = "extracting_collaborators";
      progress = 30;
    } else if (brand.ig_analysis_status === "running") {
      phase = "scraping_brand";
      progress = 15;
    } else {
      phase = "queued";
      progress = 5;
    }

    return NextResponse.json({
      phase,
      progress,
      collaborators_count: collaboratorsCount,
      creator_jobs_total: totalFanout,
      creator_jobs_done: doneFanout,
      instagram_handle: brand.instagram_handle,
      error: brand.ig_analysis_error,
    });
  } catch (err) {
    console.error("[brands/[id]/ig-analyze/status] Error:", err);
    return NextResponse.json(
      { error: "Failed to read status" },
      { status: 500 }
    );
  }
}

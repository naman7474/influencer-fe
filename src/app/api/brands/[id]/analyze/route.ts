import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

/**
 * POST /api/brands/[id]/analyze?platform=instagram|youtube
 *
 * Platform-aware replacement for /api/brands/[id]/ig-analyze. Enqueues a
 * `brand_ig_scrape` or `brand_yt_scrape` job based on ?platform. Reads the
 * brand's handle from `brand_platform_analyses(platform=?)` — falls back to
 * the legacy `brands.instagram_handle` column during the shadow-column
 * rollout (see migrations 043/044).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: brandId } = await params;
    const url = new URL(request.url);
    const platformParam = url.searchParams.get("platform") ?? "instagram";

    if (platformParam !== "instagram" && platformParam !== "youtube") {
      return NextResponse.json(
        { error: "platform must be 'instagram' or 'youtube'" },
        { status: 400 }
      );
    }
    const platform = platformParam as "instagram" | "youtube";

    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Verify brand ownership
    const { data: brandData } = await supabase
      .from("brands")
      .select("id, instagram_handle")
      .eq("id", brandId)
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as
      | { id: string; instagram_handle: string | null }
      | null;
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Resolve the handle for this platform.
    const { data: existingAnalysis } = await supabase
      .from("brand_platform_analyses")
      .select("handle, profile_url")
      .eq("brand_id", brandId)
      .eq("platform", platform)
      .maybeSingle();

    const bodyHandle = await request
      .json()
      .then((b: { handle?: string }) => b?.handle)
      .catch(() => undefined);

    const handle =
      bodyHandle ??
      (existingAnalysis as { handle?: string | null } | null)?.handle ??
      (platform === "instagram" ? brand.instagram_handle : null);

    if (!handle) {
      return NextResponse.json(
        {
          error: `Brand has no ${platform} handle. POST a { handle } body to set one.`,
        },
        { status: 400 }
      );
    }

    const workerUrl = process.env.PIPELINE_WORKER_URL;
    const workerSecret = process.env.PIPELINE_WORKER_SECRET;
    if (!workerUrl || !workerSecret) {
      return NextResponse.json(
        { error: "Pipeline worker not configured" },
        { status: 500 }
      );
    }

    const jobType = platform === "instagram" ? "brand_ig_scrape" : "brand_yt_scrape";
    const enqueueResp = await fetch(
      `${workerUrl.replace(/\/$/, "")}/enqueue`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Secret": workerSecret,
        },
        body: JSON.stringify({
          job_type: jobType,
          brand_id: brandId,
          payload: { handle, platform },
        }),
      }
    );

    if (!enqueueResp.ok) {
      const text = await enqueueResp.text();
      console.error("[analyze] enqueue failed", enqueueResp.status, text);
      return NextResponse.json(
        { error: "Failed to enqueue job" },
        { status: 502 }
      );
    }

    const { job_id: jobId, created } = (await enqueueResp.json()) as {
      job_id: string;
      created: boolean;
    };

    // Mark the platform analysis queued so the processing loader starts
    // polling. For IG we also flip the legacy shadow column; drop that
    // once the UI reads exclusively from brand_platform_analyses.
    await supabase
      .from("brand_platform_analyses")
      .upsert(
        {
          brand_id: brandId,
          platform,
          handle,
          analysis_status: "queued",
          analysis_error: null,
        } as never,
        { onConflict: "brand_id,platform" }
      );

    if (platform === "instagram") {
      await supabase
        .from("brands")
        .update({
          ig_analysis_status: "queued",
          ig_analysis_error: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", brandId);
    }

    return NextResponse.json(
      { job_id: jobId, created, status: "queued", platform },
      { status: 202 }
    );
  } catch (err) {
    console.error("[brands/[id]/analyze] Error:", err);
    return NextResponse.json(
      { error: "Failed to enqueue analysis" },
      { status: 500 }
    );
  }
}

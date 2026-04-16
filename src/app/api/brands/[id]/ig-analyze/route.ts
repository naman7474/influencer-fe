import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * POST /api/brands/[id]/ig-analyze
 * Enqueues a brand_ig_scrape background job. Idempotent — if a non-terminal
 * job already exists for this brand + type, the worker returns that job_id.
 *
 * Proxies to the Python pipeline worker (`pipeline/api.py /enqueue`) so the
 * authoritative enqueue logic lives next to the handlers that read it.
 */
export async function POST(
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
      .select("id, instagram_handle, ig_analysis_status")
      .eq("id", brandId)
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as
      | { id: string; instagram_handle: string | null; ig_analysis_status: string }
      | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
    if (!brand.instagram_handle) {
      return NextResponse.json(
        { error: "Brand has no Instagram handle" },
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

    const enqueueResp = await fetch(`${workerUrl.replace(/\/$/, "")}/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": workerSecret,
      },
      body: JSON.stringify({
        job_type: "brand_ig_scrape",
        brand_id: brandId,
        payload: { handle: brand.instagram_handle },
      }),
    });

    if (!enqueueResp.ok) {
      const text = await enqueueResp.text();
      console.error("[ig-analyze] enqueue failed", enqueueResp.status, text);
      return NextResponse.json(
        { error: "Failed to enqueue job" },
        { status: 502 }
      );
    }

    const { job_id: jobId, created } = (await enqueueResp.json()) as {
      job_id: string;
      created: boolean;
    };

    // Flip status to `queued` so the processing loader starts polling right away.
    await supabase
      .from("brands")
      .update({
        ig_analysis_status: "queued",
        ig_analysis_error: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", brandId);

    return NextResponse.json(
      { job_id: jobId, created, status: "queued" },
      { status: 202 }
    );
  } catch (err) {
    console.error("[brands/[id]/ig-analyze] Error:", err);
    return NextResponse.json(
      { error: "Failed to enqueue analysis" },
      { status: 500 }
    );
  }
}

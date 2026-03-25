import { createServiceRoleClient } from "@/lib/supabase/server";

export type BackgroundJobType = "shopify_sync" | "brand_matching";

export async function enqueueBackgroundJob(
  jobType: BackgroundJobType,
  brandId: string,
  payload: Record<string, unknown> = {}
) {
  const serviceRole = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data, error } = await serviceRole
    .from("background_jobs")
    .insert({
      job_type: jobType,
      brand_id: brandId,
      payload,
      status: "queued",
      available_at: now,
    })
    .select("*")
    .single();

  if (!error) {
    return {
      job: data,
      enqueued: true,
    };
  }

  if (error.code !== "23505") {
    throw error;
  }

  const { data: existingJob, error: existingJobError } = await serviceRole
    .from("background_jobs")
    .select("*")
    .eq("job_type", jobType)
    .eq("brand_id", brandId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingJobError) {
    throw existingJobError;
  }

  return {
    job: existingJob,
    enqueued: false,
  };
}

export async function triggerShopifySyncJob(brandId: string) {
  return enqueueBackgroundJob("shopify_sync", brandId);
}

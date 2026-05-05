import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Brand } from "@/lib/types/database";
import { DashboardClient, type DashboardStats } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: brandRow } = await supabase
    .from("brands")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!brandRow) {
    redirect("/onboarding/brand-profile");
  }

  const brand = brandRow as Brand;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRow } = await (supabase as any)
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName =
    (profileRow as { display_name: string | null } | null)?.display_name ??
    (user.user_metadata as { full_name?: string })?.full_name ??
    user.email?.split("@")[0] ??
    null;

  const [
    activeCampaignsRes,
    pendingApprovalsRes,
    activeThreadsRes,
    contentLiveRes,
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("status", "active"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("approval_queue" as any) as any)
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("status", "pending"),
    supabase
      .from("message_threads")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("status", "active"),
    supabase
      .from("campaign_creators")
      .select("id, campaigns!inner(brand_id)", { count: "exact", head: true })
      .eq("campaigns.brand_id", brand.id)
      .eq("status", "content_live"),
  ]);

  const stats: DashboardStats = {
    activeCampaigns: activeCampaignsRes.count ?? 0,
    pendingApprovals: pendingApprovalsRes.count ?? 0,
    activeThreads: activeThreadsRes.count ?? 0,
    contentLive: contentLiveRes.count ?? 0,
  };

  return <DashboardClient brand={brand} stats={stats} userDisplayName={displayName} />;
}

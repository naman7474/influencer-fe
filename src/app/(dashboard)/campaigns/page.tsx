import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCampaigns, getCampaignCreators, getStatusCounts } from "@/lib/queries/campaigns";
import { CampaignsPageClient } from "./campaigns-page-client";

export default async function CampaignsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const brand = brandRow as { id: string } | null;
  if (!brand) redirect("/onboarding/brand-profile");

  const campaigns = await getCampaigns(supabase, brand.id);

  // Fetch creator counts + status breakdowns for each campaign
  const campaignMeta: Record<
    string,
    { count: number; statusCounts: Record<string, number> }
  > = {};

  await Promise.all(
    campaigns.map(async (c) => {
      const creators = await getCampaignCreators(supabase, c.id);
      campaignMeta[c.id] = {
        count: creators.length,
        statusCounts: getStatusCounts(creators),
      };
    }),
  );

  return (
    <CampaignsPageClient
      brandId={brand.id}
      initialCampaigns={campaigns}
      campaignMeta={campaignMeta}
    />
  );
}

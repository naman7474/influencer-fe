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

  // Fetch creator counts + status breakdowns + avatar stack preview for each campaign
  const campaignMeta: Record<
    string,
    {
      count: number;
      statusCounts: Record<string, number>;
      avatars: { handle: string; avatar_url: string | null }[];
    }
  > = {};

  // Priority for the avatar stack: confirmed → content_live → completed → the rest
  const AVATAR_PRIORITY: Record<string, number> = {
    confirmed: 0,
    content_live: 1,
    completed: 2,
    negotiating: 3,
    outreach_sent: 4,
    shortlisted: 5,
    declined: 6,
  };

  await Promise.all(
    campaigns.map(async (c) => {
      const creators = await getCampaignCreators(supabase, c.id);
      const avatars = [...creators]
        .sort(
          (a, b) =>
            (AVATAR_PRIORITY[a.status] ?? 99) -
            (AVATAR_PRIORITY[b.status] ?? 99),
        )
        .slice(0, 5)
        .map((cc) => ({
          handle: cc.creator.handle,
          avatar_url: cc.creator.avatar_url,
        }));
      campaignMeta[c.id] = {
        count: creators.length,
        statusCounts: getStatusCounts(creators),
        avatars,
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

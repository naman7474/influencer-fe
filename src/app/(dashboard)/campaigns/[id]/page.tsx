import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCampaign } from "@/lib/queries/campaigns";
import { CampaignDetailClient } from "./campaign-detail-client";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const campaign = await getCampaign(supabase, id);
  if (!campaign) notFound();

  // Fetch UTM links for the campaign
  const { data: utmLinks } = await supabase
    .from("campaign_utm_links")
    .select("*")
    .eq("campaign_id", id);

  // Fetch discount codes for the campaign
  const { data: discountCodes } = await supabase
    .from("campaign_discount_codes")
    .select(
      `
      *,
      creator:creators (
        id, handle, display_name, avatar_url
      )
    `
    )
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  return (
    <CampaignDetailClient
      campaign={campaign}
      creators={campaign.creators}
      utmLinks={utmLinks ?? []}
      discountCodes={(discountCodes ?? []) as never[]}
    />
  );
}

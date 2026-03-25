import { notFound } from "next/navigation";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";
import { getCreatorFullProfile } from "@/lib/queries/creator-profile";
import { CreatorProfileClient } from "./profile-client";

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);
  const profile = await getCreatorFullProfile(supabase, handle, brand.brand_id);

  if (!profile) {
    notFound();
  }

  return (
    <CreatorProfileClient
      profile={profile}
      shopifyConnected={brand.shopify_connected}
      shopifySyncStatus={brand.shopify_sync_status}
    />
  );
}

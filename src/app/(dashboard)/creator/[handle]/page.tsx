import { notFound } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCreatorByHandle } from "@/lib/queries/creator-detail";
import type { Brand, CreatorBrandMatch } from "@/lib/types/database";
import type { SocialPlatform } from "@/lib/types/creator-detail";

import { CreatorDetailView } from "@/components/creator-profile/creator-detail-view";

/* ------------------------------------------------------------------ */
/*  Page — Phase 2 multi-platform                                     */
/* ------------------------------------------------------------------ */

export default async function CreatorProfilePage(props: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ platform?: string }>;
}) {
  const { handle } = await props.params;
  const searchParams = await props.searchParams;

  const supabase = await createServerSupabaseClient();

  const detail = await getCreatorByHandle(supabase, handle);
  if (!detail) {
    notFound();
  }

  const brandMatch = await fetchBrandMatch(supabase, detail.creator.id);

  const requestedPlatform =
    searchParams.platform === "youtube" || searchParams.platform === "instagram"
      ? (searchParams.platform as SocialPlatform)
      : undefined;

  return (
    <CreatorDetailView
      detail={detail}
      brandMatch={brandMatch}
      initialPlatform={requestedPlatform}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Fetch brand match (requires current user's brand)                  */
/* ------------------------------------------------------------------ */

async function fetchBrandMatch(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  creatorId: string,
): Promise<CreatorBrandMatch | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: brandData } = await supabase
      .from("brands")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandData as Brand | null;
    if (!brand) return null;

    // Phase 2: creator_brand_matches is now keyed by (creator, brand, platform).
    // For the detail page's summary brand-match banner we pick the row with
    // the highest match_score across platforms — the user is viewing "is this
    // creator a good match for my brand" end-to-end, not per-surface.
    const { data: matches } = await supabase
      .from("creator_brand_matches")
      .select("*")
      .eq("creator_id", creatorId)
      .eq("brand_id", brand.id)
      .order("match_score", { ascending: false })
      .limit(1);

    const arr = (matches as CreatorBrandMatch[] | null) ?? [];
    return arr[0] ?? null;
  } catch {
    return null;
  }
}

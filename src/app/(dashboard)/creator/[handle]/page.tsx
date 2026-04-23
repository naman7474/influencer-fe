import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Creator,
  CreatorScore,
  CaptionIntelligence,
  TranscriptIntelligence,
  AudienceIntelligence,
  Post,
  Brand,
  CreatorBrandMatch,
} from "@/lib/types/database";

import { ProfileHero } from "@/components/creator-profile/profile-hero";
import { StickyActionBar } from "@/components/creator-profile/sticky-action-bar";
import { TabContainer } from "@/components/creator-profile/tab-container";
import { FitTab } from "@/components/creator-profile/fit-tab";
import { CredibilityTab } from "@/components/creator-profile/credibility-tab";
import { ImpactTab } from "@/components/creator-profile/impact-tab";
import { CommerceTab } from "@/components/creator-profile/commerce-tab";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function CreatorProfilePage(props: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await props.params;

  const supabase = await createServerSupabaseClient();

  /* ── Fetch creator by handle ── */
  const { data: creator } = await supabase
    .from("creators")
    .select("*")
    .eq("handle", handle)
    .single();

  if (!creator) {
    notFound();
  }

  const creatorTyped = creator as Creator;

  /* ── Fetch all related data in parallel ── */
  const [
    { data: scores },
    { data: caption },
    { data: transcript },
    { data: audience },
    { data: posts },
    brandMatch,
  ] = await Promise.all([
    supabase
      .from("creator_scores")
      .select("*")
      .eq("creator_id", creatorTyped.id)
      .single(),
    supabase
      .from("caption_intelligence")
      .select("*")
      .eq("creator_id", creatorTyped.id)
      .single(),
    supabase
      .from("transcript_intelligence")
      .select("*")
      .eq("creator_id", creatorTyped.id)
      .single(),
    supabase
      .from("audience_intelligence")
      .select("*")
      .eq("creator_id", creatorTyped.id)
      .single(),
    supabase
      .from("posts")
      .select("*")
      .eq("creator_id", creatorTyped.id)
      .order("date_posted", { ascending: false })
      .limit(20),
    fetchBrandMatch(supabase, creatorTyped.id),
  ]);

  const scoresTyped = (scores as CreatorScore | null) ?? null;
  const captionTyped = (caption as CaptionIntelligence | null) ?? null;
  const transcriptTyped = (transcript as TranscriptIntelligence | null) ?? null;
  const audienceTyped = (audience as AudienceIntelligence | null) ?? null;
  const postsTyped = ((posts as Post[] | null) ?? []);

  /* ── Render ── */
  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto">
      {/* Hero (conviction zone) */}
      <ProfileHero
        creator={creatorTyped}
        scores={scoresTyped}
        match={brandMatch}
        caption={captionTyped}
        transcript={transcriptTyped}
        audience={audienceTyped}
      />

      {/* Tabs (diligence zone) */}
      <TabContainer
        fitTab={
          <FitTab
            creator={creatorTyped}
            scores={scoresTyped}
            caption={captionTyped}
            transcript={transcriptTyped}
            audience={audienceTyped}
            match={brandMatch}
          />
        }
        credibilityTab={
          <CredibilityTab
            creator={creatorTyped}
            scores={scoresTyped}
            caption={captionTyped}
            transcript={transcriptTyped}
            audience={audienceTyped}
          />
        }
        impactTab={
          <ImpactTab
            scores={scoresTyped}
            transcript={transcriptTyped}
            posts={postsTyped}
          />
        }
        commerceTab={
          <CommerceTab
            creator={creatorTyped}
            scores={scoresTyped}
            caption={captionTyped}
          />
        }
      />

      {/* Sticky action bar */}
      <StickyActionBar creator={creatorTyped} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fetch brand match (requires current user's brand)                  */
/* ------------------------------------------------------------------ */

async function fetchBrandMatch(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  creatorId: string
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

    const { data: match } = await supabase
      .from("creator_brand_matches")
      .select("*")
      .eq("creator_id", creatorId)
      .eq("brand_id", brand.id)
      .single();

    return (match as CreatorBrandMatch | null) ?? null;
  } catch {
    return null;
  }
}


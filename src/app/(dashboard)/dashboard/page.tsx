import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Brand,
  BrandShopifyGeo,
  Campaign,
  CreatorBrandMatch,
} from "@/lib/types/database";
import { DashboardClient } from "./dashboard-client";

/* ------------------------------------------------------------------ */
/*  Types for joined match + creator data                              */
/* ------------------------------------------------------------------ */

export interface MatchWithCreator {
  id: string;
  creator_id: string;
  match_score: number | null;
  match_reasoning: string | null;
  niche_fit_score: number | null;
  audience_geo_score: number | null;
  engagement_score: number | null;
  already_mentions_brand: boolean | null;
  mentions_competitor: boolean | null;
  creator: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    followers: number | null;
    tier: string | null;
    is_verified: boolean | null;
    city: string | null;
    country: string | null;
    category: string | null;
  };
  creator_scores: {
    cpi: number | null;
    avg_engagement_rate: number | null;
    engagement_trend: string | null;
  } | null;
  caption_intelligence: {
    primary_niche: string | null;
    primary_tone: string | null;
  } | null;
  transcript_intelligence: {
    primary_spoken_language: string | null;
  } | null;
  audience_intelligence: {
    authenticity_score: number | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Server Component                                                   */
/* ------------------------------------------------------------------ */

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  // ── 1. Authenticate ─────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // ── 2. Fetch brand data ─────────────────────────────────────────────
  const { data: brandRow } = await supabase
    .from("brands")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!brandRow) {
    redirect("/onboarding/brand-profile");
  }

  const brand = brandRow as Brand;

  // ── 3. Fetch top matches (top 10 by match_score) ────────────────────
  const { data: matchRows } = await supabase
    .from("creator_brand_matches")
    .select(
      `
      id,
      creator_id,
      match_score,
      match_reasoning,
      niche_fit_score,
      audience_geo_score,
      engagement_score,
      already_mentions_brand,
      mentions_competitor,
      creators!inner (
        handle,
        display_name,
        avatar_url,
        followers,
        tier,
        is_verified,
        city,
        country,
        category
      )
    `
    )
    .eq("brand_id", brand.id)
    .order("match_score", { ascending: false, nullsFirst: false })
    .limit(10);

  // Fetch supplementary data for matched creators
  const creatorIds = (matchRows ?? []).map(
    (m: { creator_id: string }) => m.creator_id
  );

  const [scoresResult, captionResult, transcriptResult, audienceResult] =
    creatorIds.length > 0
      ? await Promise.all([
          supabase
            .from("creator_scores")
            .select("creator_id, cpi, avg_engagement_rate, engagement_trend")
            .in("creator_id", creatorIds),
          supabase
            .from("caption_intelligence")
            .select("creator_id, primary_niche, primary_tone")
            .in("creator_id", creatorIds),
          supabase
            .from("transcript_intelligence")
            .select("creator_id, primary_spoken_language")
            .in("creator_id", creatorIds),
          supabase
            .from("audience_intelligence")
            .select("creator_id, authenticity_score")
            .in("creator_id", creatorIds),
        ])
      : [
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
        ];

  // Index supplementary data by creator_id
  const scoresMap = new Map(
    ((scoresResult.data ?? []) as Array<{
      creator_id: string;
      cpi: number | null;
      avg_engagement_rate: number | null;
      engagement_trend: string | null;
    }>).map((r) => [r.creator_id, r])
  );
  const captionMap = new Map(
    ((captionResult.data ?? []) as Array<{
      creator_id: string;
      primary_niche: string | null;
      primary_tone: string | null;
    }>).map((r) => [r.creator_id, r])
  );
  const transcriptMap = new Map(
    ((transcriptResult.data ?? []) as Array<{
      creator_id: string;
      primary_spoken_language: string | null;
    }>).map((r) => [r.creator_id, r])
  );
  const audienceMap = new Map(
    ((audienceResult.data ?? []) as Array<{
      creator_id: string;
      authenticity_score: number | null;
    }>).map((r) => [r.creator_id, r])
  );

  // Assemble MatchWithCreator objects
  const topMatches: MatchWithCreator[] = (matchRows ?? []).map(
    (row: Record<string, unknown>) => {
      const creatorId = row.creator_id as string;
      const creators = row.creators as {
        handle: string;
        display_name: string | null;
        avatar_url: string | null;
        followers: number | null;
        tier: string | null;
        is_verified: boolean | null;
        city: string | null;
        country: string | null;
        category: string | null;
      };

      return {
        id: row.id as string,
        creator_id: creatorId,
        match_score: row.match_score as number | null,
        match_reasoning: row.match_reasoning as string | null,
        niche_fit_score: row.niche_fit_score as number | null,
        audience_geo_score: row.audience_geo_score as number | null,
        engagement_score: row.engagement_score as number | null,
        already_mentions_brand: row.already_mentions_brand as boolean | null,
        mentions_competitor: row.mentions_competitor as boolean | null,
        creator: creators,
        creator_scores: scoresMap.get(creatorId) ?? null,
        caption_intelligence: captionMap.get(creatorId) ?? null,
        transcript_intelligence: transcriptMap.get(creatorId) ?? null,
        audience_intelligence: audienceMap.get(creatorId) ?? null,
      };
    }
  );

  // ── 4. Fetch active campaigns ───────────────────────────────────────
  const { data: campaignRows } = await supabase
    .from("campaigns")
    .select("*")
    .eq("brand_id", brand.id)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: false })
    .limit(5);

  const campaigns = (campaignRows ?? []) as Campaign[];

  // ── 5. Fetch brand_shopify_geo ──────────────────────────────────────
  const { data: geoRows } = await supabase
    .from("brand_shopify_geo")
    .select("*")
    .eq("brand_id", brand.id)
    .order("gap_score", { ascending: false, nullsFirst: false });

  const geoData = (geoRows ?? []) as BrandShopifyGeo[];

  // 5b. Overlay fresh classifications from v_brand_geo_gaps (the view
  // recomputes problem_type on read, so stored problem_type is ignored).
  if (geoData.length > 0) {
    const { data: gapRows } = await supabase
      .from("v_brand_geo_gaps" as never)
      .select("state, city, problem_type_current")
      .eq("brand_id", brand.id);
    const gapMap = new Map<string, string>();
    for (const r of (gapRows ?? []) as Array<{
      state: string | null;
      city: string | null;
      problem_type_current: string | null;
    }>) {
      const key = `${(r.city ?? "").toLowerCase()}|${(r.state ?? "").toLowerCase()}`;
      if (r.problem_type_current) gapMap.set(key, r.problem_type_current);
    }
    for (const g of geoData) {
      const key = `${(g.city ?? "").toLowerCase()}|${(g.state ?? "").toLowerCase()}`;
      const fresh = gapMap.get(key);
      if (fresh) {
        (g as BrandShopifyGeo).problem_type =
          fresh as BrandShopifyGeo["problem_type"];
      }
    }
  }

  // ── 6. Render ───────────────────────────────────────────────────────
  return (
    <DashboardClient
      brand={brand}
      topMatches={topMatches}
      campaigns={campaigns}
      geoData={geoData}
    />
  );
}

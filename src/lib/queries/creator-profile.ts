import { SupabaseClient } from "@supabase/supabase-js";

async function fetchCreatorRelatedData(
  supabase: SupabaseClient,
  creatorId: string,
  brandId?: string
) {
  const requests = [
    supabase
      .from("creator_scores")
      .select("*")
      .eq("creator_id", creatorId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("caption_intelligence")
      .select("*")
      .eq("creator_id", creatorId)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transcript_intelligence")
      .select("*")
      .eq("creator_id", creatorId)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("audience_intelligence")
      .select("*")
      .eq("creator_id", creatorId)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("posts")
      .select("*")
      .eq("creator_id", creatorId)
      .order("date_posted", { ascending: false })
      .limit(20),
    brandId
      ? supabase
          .from("creator_brand_matches")
          .select("*")
          .eq("creator_id", creatorId)
          .eq("brand_id", brandId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ] as const;

  const [
    scoresRes,
    captionRes,
    transcriptRes,
    audienceRes,
    postsRes,
    brandMatchRes,
  ] = await Promise.all(requests);

  return {
    scores: scoresRes.data,
    captionIntel: captionRes.data,
    transcriptIntel: transcriptRes.data,
    audienceIntel: audienceRes.data,
    posts: postsRes.data ?? [],
    brandMatch: brandMatchRes.data,
  };
}

export async function getCreatorProfile(
  supabase: SupabaseClient,
  handle: string,
  brandId?: string
) {
  return getCreatorFullProfile(supabase, handle, brandId);
}

export async function getCreatorFullProfile(
  supabase: SupabaseClient,
  handle: string,
  brandId?: string
) {
  const { data: creator, error } = await supabase
    .from("creators")
    .select("*")
    .eq("handle", handle)
    .single();

  if (error || !creator) return null;

  const related = await fetchCreatorRelatedData(supabase, creator.id, brandId);

  return {
    creator,
    ...related,
  };
}

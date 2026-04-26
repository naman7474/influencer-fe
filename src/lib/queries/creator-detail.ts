import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Creator,
  CreatorScore,
  CaptionIntelligence,
  TranscriptIntelligence,
  AudienceIntelligence,
  Post,
} from "@/lib/types/database";
import type {
  CreatorDetail,
  CreatorPlatformProfile,
  ContentItem,
  IntelligenceBundle,
  SocialPlatform,
  YoutubeVideoItem,
} from "@/lib/types/creator-detail";

/**
 * Multi-platform creator-detail reader. Looks up by handle against both
 * `creators.handle` (legacy IG-primary key) and
 * `creator_social_profiles.handle` (Phase 1 junction) so that a YT-first
 * creator whose IG-style handle was suffixed `_yt` is still reachable
 * by either form.
 *
 * Returns the canonical `creators.id` plus per-platform scores,
 * intelligence, and content. When a creator is on both IG and YT we
 * emit two profile entries — the page renders platform sub-tabs.
 */
export async function getCreatorByHandle(
  supabase: SupabaseClient<Database>,
  handle: string,
): Promise<CreatorDetail | null> {
  // 1. Resolve handle → canonical creators.id.
  // Try the legacy direct hit first (fast path, cheapest index lookup).
  let creatorId: string | null = null;
  let creatorRow: Creator | null = null;

  const { data: directRow } = await supabase
    .from("creators")
    .select("*")
    .eq("handle", handle)
    .maybeSingle();

  if (directRow) {
    creatorId = (directRow as Creator).id;
    creatorRow = directRow as Creator;
  } else {
    // Fall through to the junction table — picks up YT-suffixed handles
    // + any platform where the handle doesn't coincide with creators.handle.
    const { data: cspRow } = await supabase
      .from("creator_social_profiles")
      .select("creator_id")
      .eq("handle", handle)
      .limit(1)
      .maybeSingle();
    if (cspRow) {
      creatorId = (cspRow as { creator_id: string }).creator_id;
      const { data: creatorByIdRow } = await supabase
        .from("creators")
        .select("*")
        .eq("id", creatorId)
        .maybeSingle();
      creatorRow = (creatorByIdRow as Creator | null) ?? null;
    }
  }

  if (!creatorId || !creatorRow) return null;

  // 2. Fetch everything platform-scoped in parallel.
  const [
    profilesRes,
    scoresRes,
    captionRes,
    transcriptRes,
    audienceRes,
    postsRes,
    ytVideosRes,
  ] = await Promise.all([
    supabase
      .from("creator_social_profiles")
      .select("*")
      .eq("creator_id", creatorId)
      .eq("is_active", true),
    supabase
      .from("creator_scores")
      .select("*")
      .eq("creator_id", creatorId)
      .order("computed_at", { ascending: false }),
    supabase
      .from("caption_intelligence")
      .select("*")
      .eq("creator_id", creatorId)
      .order("analyzed_at", { ascending: false }),
    supabase
      .from("transcript_intelligence")
      .select("*")
      .eq("creator_id", creatorId)
      .order("analyzed_at", { ascending: false }),
    supabase
      .from("audience_intelligence")
      .select("*")
      .eq("creator_id", creatorId)
      .order("analyzed_at", { ascending: false }),
    supabase
      .from("posts")
      .select("*")
      .eq("creator_id", creatorId)
      .order("date_posted", { ascending: false })
      .limit(20),
    supabase
      .from("youtube_videos" as never)
      .select("*")
      .eq("creator_id", creatorId)
      .order("published_at", { ascending: false })
      .limit(20),
  ]);

  const profiles = ((profilesRes.data ?? []) as CreatorPlatformProfile[]).filter(
    (p) => p.platform === "instagram" || p.platform === "youtube",
  );
  if (profiles.length === 0) {
    // No junction rows yet — synthesize a single IG profile from the
    // shadow columns on `creators`. Keeps /creator/[handle] working for
    // creators scraped pre-migration-044.
    profiles.push({
      creator_id: creatorId,
      platform: "instagram",
      handle: creatorRow.handle,
      platform_user_id: (creatorRow as Creator & {
        instagram_id: string | null;
      }).instagram_id,
      profile_url: `https://www.instagram.com/${creatorRow.handle}/`,
      display_name: creatorRow.display_name,
      bio: creatorRow.biography,
      avatar_url: creatorRow.avatar_url,
      category: creatorRow.category,
      country: creatorRow.country,
      is_verified: creatorRow.is_verified ?? false,
      is_business: creatorRow.is_business ?? false,
      followers_or_subs: creatorRow.followers ?? 0,
      posts_or_videos_count: creatorRow.posts_count ?? 0,
      avg_engagement: null,
      external_links: [],
      last_synced_at: creatorRow.last_scraped_at,
    });
  }

  // Build per-platform maps. Each table is ordered desc by timestamp so
  // we take the first match per platform (= latest).
  const scoresByPlatform = _pickLatestPerPlatform<CreatorScore>(
    (scoresRes.data ?? []) as Array<CreatorScore & { platform: SocialPlatform }>,
  );
  const captionByPlatform = _pickLatestPerPlatform<CaptionIntelligence>(
    (captionRes.data ?? []) as Array<
      CaptionIntelligence & { platform: SocialPlatform }
    >,
  );
  const transcriptByPlatform = _pickLatestPerPlatform<TranscriptIntelligence>(
    (transcriptRes.data ?? []) as Array<
      TranscriptIntelligence & { platform: SocialPlatform }
    >,
  );
  const audienceByPlatform = _pickLatestPerPlatform<AudienceIntelligence>(
    (audienceRes.data ?? []) as Array<
      AudienceIntelligence & { platform: SocialPlatform }
    >,
  );

  const intelligence_by_platform: Partial<Record<SocialPlatform, IntelligenceBundle>> = {};
  for (const platform of ["instagram", "youtube"] as SocialPlatform[]) {
    intelligence_by_platform[platform] = {
      caption: captionByPlatform[platform] ?? null,
      transcript: transcriptByPlatform[platform] ?? null,
      audience: audienceByPlatform[platform] ?? null,
    };
  }

  // IG content: `posts` is platform-scoped post-migration-043.
  const igPosts = ((postsRes.data ?? []) as Array<Post & { platform: string }>)
    .filter((p) => (p.platform ?? "instagram") === "instagram")
    .map((p): ContentItem => ({ kind: "ig_post", ...(p as Post) }));

  // YT content: from the youtube_videos table.
  const ytVideos = ((ytVideosRes.data ?? []) as YoutubeVideoItem[]).map(
    (v): ContentItem => ({ kind: "yt_video", ...v }),
  );

  const content_by_platform: Partial<Record<SocialPlatform, ContentItem[]>> = {
    instagram: igPosts,
    youtube: ytVideos,
  };

  // Primary platform = the one with the most followers/subs.
  const primary_platform: SocialPlatform =
    profiles
      .slice()
      .sort((a, b) => (b.followers_or_subs ?? 0) - (a.followers_or_subs ?? 0))[0]
      ?.platform ?? "instagram";

  return {
    creator: creatorRow,
    profiles,
    scores_by_platform: scoresByPlatform,
    intelligence_by_platform,
    content_by_platform,
    primary_platform,
  };
}

function _pickLatestPerPlatform<T>(
  rows: Array<T & { platform?: SocialPlatform | string | null }>,
): Partial<Record<SocialPlatform, T>> {
  const out: Partial<Record<SocialPlatform, T>> = {};
  for (const row of rows) {
    const p = (row.platform ?? "instagram") as SocialPlatform;
    if (p !== "instagram" && p !== "youtube") continue;
    if (!out[p]) out[p] = row;
  }
  return out;
}

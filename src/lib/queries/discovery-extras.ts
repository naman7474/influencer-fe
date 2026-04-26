import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export interface CreatorExtras {
  matchScore: number | null;
  matchReasoning: string | null;
  avgViews: number | null;
}

interface BrandMatchRow {
  creator_id: string;
  match_score: number | null;
  match_reasoning: string | null;
}

interface PostViewRow {
  creator_id: string;
  video_view_count: number | null;
  video_play_count: number | null;
}

interface YoutubeVideoRow {
  creator_id: string;
  view_count: number | null;
}

/**
 * Batch-fetch enrichment data for the current page of discover results:
 *   - Brand match score (vs. the current user's brand)
 *   - Average views (computed from `posts` for IG creators, `youtube_videos` for YT)
 *
 * One round-trip per data source per page (3 queries total, all parallel).
 * Falls back to `null` for creators with no data — caller decides display.
 */
export async function fetchCreatorExtras(
  supabase: SupabaseClient<Database>,
  creatorIds: string[],
): Promise<Map<string, CreatorExtras>> {
  const extras = new Map<string, CreatorExtras>();
  for (const id of creatorIds) {
    extras.set(id, { matchScore: null, matchReasoning: null, avgViews: null });
  }
  if (creatorIds.length === 0) return extras;

  // Resolve current brand (for match score). If user not signed in or no brand
  // row, brand match block stays null — the card just hides that metric.
  const brandIdPromise = (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: brandRow } = await supabase
        .from("brands")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      return (brandRow as { id: string } | null)?.id ?? null;
    } catch {
      return null;
    }
  })();

  const brandId = await brandIdPromise;

  const [matchRes, igRes, ytRes] = await Promise.all([
    brandId
      ? supabase
          .from("creator_brand_matches")
          .select("creator_id, match_score, match_reasoning")
          .eq("brand_id", brandId)
          .in("creator_id", creatorIds)
          .order("match_score", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("posts")
      .select("creator_id, video_view_count, video_play_count")
      .in("creator_id", creatorIds)
      .order("date_posted", { ascending: false })
      .limit(creatorIds.length * 12),
    supabase
      .from("youtube_videos" as never)
      .select("creator_id, view_count")
      .in("creator_id", creatorIds)
      .order("published_at", { ascending: false })
      .limit(creatorIds.length * 12),
  ]);

  // Brand match — keep best score per creator (the order:desc above puts it first).
  const matchRows = (matchRes.data ?? []) as unknown as BrandMatchRow[];
  for (const row of matchRows) {
    const slot = extras.get(row.creator_id);
    if (!slot) continue;
    if (slot.matchScore == null && row.match_score != null) {
      slot.matchScore = row.match_score;
      slot.matchReasoning = row.match_reasoning;
    }
  }

  // Avg views: average of available view counts per creator across both surfaces.
  // For each platform we accumulate sum + count separately so a creator with
  // both IG & YT content gets a blended figure (matches the "all" / blended
  // leaderboard view's behaviour). For platform-filtered queries only one of
  // the two will yield rows for that creator.
  const sums = new Map<string, { sum: number; count: number }>();
  const bumpView = (creatorId: string, value: number | null | undefined) => {
    if (value == null || value <= 0 || !Number.isFinite(value)) return;
    const cur = sums.get(creatorId) ?? { sum: 0, count: 0 };
    cur.sum += value;
    cur.count += 1;
    sums.set(creatorId, cur);
  };
  const igRows = (igRes.data ?? []) as unknown as PostViewRow[];
  for (const row of igRows) {
    bumpView(row.creator_id, row.video_view_count ?? row.video_play_count);
  }
  const ytRows = (ytRes.data ?? []) as unknown as YoutubeVideoRow[];
  for (const row of ytRows) {
    bumpView(row.creator_id, row.view_count);
  }
  for (const [id, agg] of sums) {
    const slot = extras.get(id);
    if (!slot) continue;
    slot.avgViews = agg.count > 0 ? Math.round(agg.sum / agg.count) : null;
  }

  return extras;
}

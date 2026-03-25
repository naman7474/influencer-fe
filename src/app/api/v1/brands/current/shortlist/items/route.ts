import { apiError, apiOk } from "@/lib/api";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";
import type { CreatorDiscoveryCard } from "@/types/api";

function mapShortlistRow(
  row: Record<string, unknown>,
  shortlistItemId: string
): CreatorDiscoveryCard {
  return {
    creator_id: String(row.creator_id),
    handle: (row.handle as string) ?? "",
    display_name: (row.display_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    is_verified: Boolean(row.is_verified),
    tier: (row.tier as CreatorDiscoveryCard["tier"]) ?? null,
    followers: (row.followers as number | null) ?? null,
    posts_count: (row.posts_count as number | null) ?? null,
    city: (row.city as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    cpi: (row.cpi as number | null) ?? null,
    avg_engagement_rate: (row.avg_engagement_rate as number | null) ?? null,
    engagement_trend:
      (row.engagement_trend as CreatorDiscoveryCard["engagement_trend"]) ??
      "insufficient_data",
    audience_authenticity_score:
      (row.audience_authenticity_score as number | null) ?? null,
    primary_niche: (row.primary_niche as string | null) ?? null,
    secondary_niche: (row.secondary_niche as string | null) ?? null,
    primary_tone: (row.primary_tone as string | null) ?? null,
    audience_country: (row.audience_country as string | null) ?? null,
    match_score: null,
    shortlist_state: {
      is_shortlisted: true,
      shortlist_item_id: shortlistItemId,
    },
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const { data: shortlistItems, error } = await supabase
      .from("brand_shortlist_items")
      .select("id, creator_id, created_at")
      .eq("brand_id", brand.brand_id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const creatorIds = (shortlistItems ?? []).map((item) => item.creator_id);
    if (creatorIds.length === 0) {
      return apiOk({ items: [] as CreatorDiscoveryCard[] });
    }

    const { data: creators, error: creatorError } = await supabase
      .from("mv_creator_leaderboard")
      .select("*")
      .in("creator_id", creatorIds);

    if (creatorError) {
      throw creatorError;
    }

    const creatorMap = new Map(
      (creators ?? []).map((creator) => [
        String(creator.creator_id),
        creator as Record<string, unknown>,
      ])
    );

    const items = (shortlistItems ?? [])
      .map((item) => {
        const creator = creatorMap.get(String(item.creator_id));
        if (!creator) {
          return null;
        }

        return mapShortlistRow(creator, item.id);
      })
      .filter((item): item is CreatorDiscoveryCard => Boolean(item));

    return apiOk({ items });
  } catch (error) {
    return apiError(500, {
      code: "shortlist_fetch_failed",
      message:
        error instanceof Error ? error.message : "Unable to load shortlist.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      creator_id?: string;
      source?: string;
    };

    if (!body.creator_id) {
      return apiError(400, {
        code: "validation_error",
        message: "creator_id is required.",
      });
    }

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const { data, error } = await supabase
      .from("brand_shortlist_items")
      .upsert(
        {
          brand_id: brand.brand_id,
          creator_id: body.creator_id,
          source: body.source || "manual",
        },
        { onConflict: "brand_id,creator_id" }
      )
      .select("id, creator_id, created_at")
      .single();

    if (error) {
      throw error;
    }

    return apiOk(
      {
        shortlist_item_id: data.id,
        creator_id: data.creator_id,
        is_shortlisted: true,
        created_at: data.created_at,
      },
      undefined,
      201
    );
  } catch (error) {
    return apiError(500, {
      code: "shortlist_create_failed",
      message:
        error instanceof Error ? error.message : "Unable to create shortlist item.",
    });
  }
}

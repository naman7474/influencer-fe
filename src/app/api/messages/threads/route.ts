import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/messages/threads
 * List message threads for the authenticated brand.
 * Supports filtering by status, campaign, and search.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;
    if (!brand) {
      return NextResponse.json(
        { error: "Brand profile not found." },
        { status: 404 }
      );
    }

    // Parse filters
    const filter = searchParams.get("filter"); // all | unread | sent | drafts
    const campaignId = searchParams.get("campaign_id");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("message_threads")
      .select(
        `
        *,
        creators!inner (
          id,
          handle,
          display_name,
          avatar_url,
          contact_email
        ),
        campaigns (
          id,
          name
        )
      `,
        { count: "exact" }
      )
      .eq("brand_id", brand.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filter === "unread") {
      query = query.gt("unread_count", 0);
    } else if (filter === "sent") {
      query = query.eq("last_message_direction", "outbound");
    } else if (filter === "drafts") {
      query = query.eq("outreach_status", "draft");
    }

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    if (search) {
      query = query.ilike("creators.handle", `%${search}%`);
    }

    const { data: threads, count, error } = await query;

    if (error) {
      console.error("Threads list error:", error);
      return NextResponse.json(
        { error: "Failed to fetch threads." },
        { status: 500 }
      );
    }

    // Bulk-fetch match scores for the creators in this page of threads.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const threadList = (threads || []) as any[];
    const creatorIds = Array.from(
      new Set(threadList.map((t) => t.creators?.id).filter(Boolean) as string[])
    );

    const scoreByCreator = new Map<string, number>();
    if (creatorIds.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: matches } = await (supabase as any)
        .from("creator_brand_matches")
        .select("creator_id, match_score")
        .eq("brand_id", brand.id)
        .in("creator_id", creatorIds);

      // creator_brand_matches is keyed by (creator, brand, platform) so a
      // creator can have multiple rows. Take the highest. Also: match_score
      // is stored as either 0-1 (decimal) or 0-100 (percent) depending on
      // the pipeline run — normalize to 0-100 for display.
      for (const m of (matches ?? []) as Array<{
        creator_id: string;
        match_score: number | null;
      }>) {
        if (m.match_score == null) continue;
        const raw = Number(m.match_score);
        const normalized = raw <= 1 ? raw * 100 : raw;
        const prev = scoreByCreator.get(m.creator_id);
        if (prev == null || normalized > prev) {
          scoreByCreator.set(m.creator_id, normalized);
        }
      }
    }

    const enriched = threadList.map((t) => ({
      ...t,
      match_score: t.creators?.id
        ? scoreByCreator.get(t.creators.id) ?? null
        : null,
    }));

    return NextResponse.json({
      threads: enriched,
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("Threads error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

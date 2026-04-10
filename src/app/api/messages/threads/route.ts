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

    return NextResponse.json({
      threads: threads || [],
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

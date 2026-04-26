import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

interface CreatorRow {
  id: string;
  handle: string;
  display_name: string | null;
  contact_email: string | null;
  avatar_url: string | null;
  followers: number | null;
}

/**
 * GET /api/creators/search?q=...&limit=8
 *
 * Lightweight creator lookup by handle / display_name. Used by the outreach
 * compose modal so search works against the full `creators` catalogue, not
 * just creators with existing message threads.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limitRaw = parseInt(searchParams.get("limit") ?? "8", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 25) : 8;

    if (q.length < 2) {
      return NextResponse.json({ creators: [] });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Escape PostgREST `.or()` reserved chars: ',' and '()'
    const safe = q.replace(/[(),]/g, " ");
    const term = `%${safe}%`;

    const { data, error } = await supabase
      .from("creators")
      .select("id, handle, display_name, contact_email, avatar_url, followers")
      .or(`handle.ilike.${term},display_name.ilike.${term}`)
      .order("followers", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error("creators/search:", error);
      return NextResponse.json({ creators: [] }, { status: 500 });
    }

    return NextResponse.json({ creators: (data ?? []) as CreatorRow[] });
  } catch (err) {
    console.error("creators/search error:", err);
    return NextResponse.json({ creators: [] }, { status: 500 });
  }
}

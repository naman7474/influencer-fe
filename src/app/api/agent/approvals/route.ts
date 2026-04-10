import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase
      .from("approval_queue") as any)
      .select("*")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: approvalsRaw, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: `Failed to load approvals: ${error.message}` },
        { status: 500 }
      );
    }

    const approvals = (approvalsRaw || []) as Array<Record<string, unknown>>;

    // Separately fetch creator details for items that have a creator_id
    const creatorIds = approvals
      .map((a) => a.creator_id as string | null)
      .filter((id): id is string => !!id);

    let creatorsMap: Record<string, Record<string, unknown>> = {};
    if (creatorIds.length > 0) {
      const { data: creatorsRaw } = await supabase
        .from("creators")
        .select("id, handle, display_name, avatar_url, followers, tier")
        .in("id", [...new Set(creatorIds)]);
      const creators = (creatorsRaw || []) as Array<Record<string, unknown>>;
      creatorsMap = Object.fromEntries(creators.map((c) => [c.id, c]));
    }

    const items = approvals.map((a) => ({
      ...a,
      creator: a.creator_id ? creatorsMap[a.creator_id as string] || null : null,
    }));

    // Get pending count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: pendingCount } = await (supabase
      .from("approval_queue") as any)
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("status", "pending");

    return NextResponse.json({
      success: true,
      items,
      pending_count: pendingCount || 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load approvals" },
      { status: 500 }
    );
  }
}

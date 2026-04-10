import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      .select(
        "*, creators(handle, display_name, avatar_url, followers, tier)"
      )
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: approvals, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: `Failed to load approvals: ${error.message}` },
        { status: 500 }
      );
    }

    // Get pending count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: pendingCount } = await (supabase
      .from("approval_queue") as any)
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("status", "pending");

    return NextResponse.json({
      success: true,
      items: approvals || [],
      pending_count: pendingCount || 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load approvals" },
      { status: 500 }
    );
  }
}

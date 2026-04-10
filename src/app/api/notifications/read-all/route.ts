import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read.
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;
    if (!brand) {
      return NextResponse.json({ error: "Brand not found." }, { status: 404 });
    }

    await supabase
      .from("notifications")
      .update({ read: true } as never)
      .eq("brand_id", brand.id)
      .eq("read", false);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Read-all error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

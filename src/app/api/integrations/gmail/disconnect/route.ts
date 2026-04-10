import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/integrations/gmail/disconnect
 * Disconnects Gmail by clearing the stored connection.
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

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

    await supabase
      .from("brands")
      .update({
        gmail_connected: false,
        gmail_email: null,
        gmail_access_token: null,
        gmail_refresh_token: null,
        gmail_token_expires_at: null,
      } as never)
      .eq("id", brand.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Gmail disconnect error:", err);
    return NextResponse.json(
      { error: "Failed to disconnect Gmail." },
      { status: 500 }
    );
  }
}

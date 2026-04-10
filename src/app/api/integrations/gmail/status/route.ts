import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/integrations/gmail/status
 * Returns Gmail connection status and daily send count.
 */
export async function GET(_request: NextRequest) {
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
      .select(
        "id, gmail_connected, gmail_email, email_sender_name, email_include_tracking, email_include_logo"
      )
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as {
      id: string;
      gmail_connected: boolean;
      gmail_email: string | null;
      email_sender_name: string | null;
      email_include_tracking: boolean;
      email_include_logo: boolean;
    } | null;

    if (!brand) {
      return NextResponse.json(
        { error: "Brand profile not found." },
        { status: 404 }
      );
    }

    // Get today's send count
    const today = new Date().toISOString().split("T")[0];
    const { count: dailySentCount } = await supabase
      .from("outreach_messages")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .gte("sent_at", `${today}T00:00:00Z`)
      .in("status", ["sent", "delivered", "opened", "replied"]);

    return NextResponse.json({
      connected: brand.gmail_connected ?? false,
      email: brand.gmail_email ?? null,
      sender_name: brand.email_sender_name ?? null,
      include_tracking: brand.email_include_tracking ?? true,
      include_logo: brand.email_include_logo ?? true,
      daily_sent: dailySentCount ?? 0,
      daily_limit: 500,
    });
  } catch (err) {
    console.error("Gmail status error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Gmail status." },
      { status: 500 }
    );
  }
}

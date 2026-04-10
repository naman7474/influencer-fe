import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildGoogleOAuthUrl } from "@/lib/gmail";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

/**
 * POST /api/integrations/gmail/connect
 * Generates a Google OAuth consent URL and returns it.
 * The brand will be redirected to Google to authorize Gmail access.
 */
export async function POST(request: NextRequest) {
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

    // CSRF state nonce
    const state = randomBytes(24).toString("hex");

    const cookieStore = await cookies();
    cookieStore.set("gmail_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    cookieStore.set("gmail_oauth_brand_id", brand.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/integrations/gmail/callback`;
    const authUrl = buildGoogleOAuthUrl(redirectUri, state);

    return NextResponse.json({
      success: true,
      redirect_url: authUrl,
    });
  } catch (err) {
    console.error("Gmail connect error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

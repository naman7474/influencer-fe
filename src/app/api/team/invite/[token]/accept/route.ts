import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { consumeInvite } from "@/lib/auth/team";

/**
 * POST /api/team/invite/[token]/accept
 * Accept an invite as the currently authenticated user. The invite's email
 * must match the user's auth email.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email)
    return NextResponse.json({ error: "Sign in to accept the invite" }, { status: 401 });

  const result = await consumeInvite({
    token,
    userId: user.id,
    userEmail: user.email,
  });

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({
    ok: true,
    brand_id: result.brandId,
    role: result.role,
  });
}

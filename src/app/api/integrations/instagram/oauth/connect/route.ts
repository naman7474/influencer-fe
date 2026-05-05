import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getActiveMembership, requireBrandRole, AuthorizationError } from "@/lib/auth/membership";
import { buildMetaAuthUrl } from "@/lib/instagram/oauth";

/**
 * GET /api/integrations/instagram/oauth/connect
 * Redirects the caller into Meta's OAuth flow. Requires admin+ on the brand.
 */
export async function GET(request: NextRequest) {
  const ctx = await getActiveMembership();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await requireBrandRole(ctx.brandId, "admin");
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json({ error: e.reason }, { status: 403 });
    throw e;
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/integrations/instagram/oauth/callback`;

  // Pack brand_id into state alongside CSRF nonce. We don't persist state
  // server-side; the callback decodes the brand_id and trusts the auth check
  // that runs there.
  const nonce = randomBytes(16).toString("hex");
  const state = `${ctx.brandId}.${nonce}`;

  const url = buildMetaAuthUrl(redirectUri, state);
  const res = NextResponse.redirect(url);
  res.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

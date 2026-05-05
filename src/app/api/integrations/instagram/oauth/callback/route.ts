import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { exchangeCode, getLongLivedToken, resolveIgBusinessLink } from "@/lib/instagram/oauth";
import { encryptToken } from "@/lib/instagram/token-encryption";
import { getBrandRole, hasRoleAtLeast } from "@/lib/auth/membership";

/**
 * GET /api/integrations/instagram/oauth/callback?code=...&state=brand_id.nonce
 *
 * Exchanges code → user token → long-lived token, locates the IG Business
 * Account, stores it in brand_instagram_accounts. Caller must still be an
 * admin+ on the brand identified by `state`.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("ig_oauth_state")?.value;
  const errorParam = url.searchParams.get("error");

  const settingsUrl = `${url.origin}/settings`;
  const fail = (reason: string) =>
    NextResponse.redirect(`${settingsUrl}?ig=error&reason=${encodeURIComponent(reason)}`);

  if (errorParam) return fail(errorParam);
  if (!code || !state) return fail("missing_params");
  if (state !== cookieState) return fail("state_mismatch");

  const [brandId] = state.split(".");
  if (!brandId) return fail("bad_state");

  // Re-authorize: caller must be authenticated and an admin+ of `brandId`.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthenticated");
  const role = await getBrandRole(brandId);
  if (!role || !hasRoleAtLeast(role, "admin")) return fail("forbidden");

  const redirectUri = `${url.origin}/api/integrations/instagram/oauth/callback`;

  let userToken: string;
  let expiresIn: number;
  try {
    const short = await exchangeCode(code, redirectUri);
    const long = await getLongLivedToken(short.accessToken);
    userToken = long.accessToken;
    expiresIn = long.expiresIn;
  } catch (e) {
    console.error("ig oauth exchange failed", e);
    return fail("exchange_failed");
  }

  let link;
  try {
    link = await resolveIgBusinessLink(userToken);
  } catch (e) {
    console.error("ig oauth resolve failed", e);
    return fail("resolve_failed");
  }
  if (!link) return fail("no_ig_business_account");

  const svc = createServiceRoleClient();
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any).from("brand_instagram_accounts").upsert(
    {
      brand_id: brandId,
      account_type: "business",
      meta_user_id: link.metaUserId,
      page_id: link.pageId,
      ig_business_account_id: link.igBusinessAccountId,
      ig_user_id: link.igBusinessAccountId,
      ig_username: link.igUsername,
      access_token: encryptToken(link.pageAccessToken),
      token_expires_at: tokenExpiresAt,
      connected_by_user_id: user.id,
      personal_token_kind: null,
    },
    { onConflict: "brand_id" }
  );
  if (error) {
    console.error("ig oauth upsert failed", error);
    return fail("persist_failed");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from("brands")
    .update({
      instagram_connected: true,
      instagram_connected_at: new Date().toISOString(),
    })
    .eq("id", brandId);

  const res = NextResponse.redirect(`${settingsUrl}?ig=connected`);
  res.cookies.delete("ig_oauth_state");
  return res;
}

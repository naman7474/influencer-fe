import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveMembership, requireBrandRole, AuthorizationError } from "@/lib/auth/membership";
import { validatePersonalToken, type PersonalTokenKind } from "@/lib/instagram/personal";
import { encryptToken } from "@/lib/instagram/token-encryption";

/**
 * POST /api/integrations/instagram/personal
 * Body: { username, access_token, token_kind? }
 *
 * Connects a personal IG account using a pasted access token. token_kind
 * is optional — if omitted, defaults to 'graph_basic' and we probe the
 * IG Graph user-token endpoint. For 'session' or 'apify_actor' kinds, we
 * trust the assertion and rely on the worker to fail loudly if the token
 * is invalid.
 */
export async function POST(request: NextRequest) {
  const ctx = await getActiveMembership();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await requireBrandRole(ctx.brandId, "admin");
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json({ error: e.reason }, { status: 403 });
    throw e;
  }

  let body: { username?: string; access_token?: string; token_kind?: PersonalTokenKind };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = body.username?.trim().replace(/^@/, "");
  const token = body.access_token?.trim();
  if (!username || !token)
    return NextResponse.json(
      { error: "username and access_token are required" },
      { status: 400 }
    );

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const validation = await validatePersonalToken({
    token,
    username,
    hint: body.token_kind,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any).from("brand_instagram_accounts").upsert(
    {
      brand_id: ctx.brandId,
      account_type: "personal",
      ig_username: validation.ig_username,
      ig_user_id: validation.ig_user_id || username,
      access_token: encryptToken(token),
      personal_token_kind: validation.personal_token_kind,
      page_id: null,
      ig_business_account_id: null,
      meta_user_id: null,
      connected_by_user_id: user.id,
    },
    { onConflict: "brand_id" }
  );

  if (error) {
    console.error("ig personal upsert failed", error);
    return NextResponse.json({ error: "persist_failed" }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from("brands")
    .update({
      instagram_connected: true,
      instagram_connected_at: new Date().toISOString(),
    })
    .eq("id", ctx.brandId);

  return NextResponse.json({
    ok: true,
    ig_username: validation.ig_username,
    token_kind: validation.personal_token_kind,
  });
}

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveMembership, requireBrandRole, AuthorizationError } from "@/lib/auth/membership";

/**
 * GET /api/integrations/instagram
 * Returns the connection status for the active brand.
 */
export async function GET() {
  const ctx = await getActiveMembership();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("brand_instagram_accounts")
    .select(
      "id, account_type, ig_username, ig_business_account_id, last_dm_sync_at, token_expires_at, personal_token_kind, connected_by_user_id"
    )
    .eq("brand_id", ctx.brandId)
    .maybeSingle();

  return NextResponse.json({ account: data ?? null });
}

/**
 * DELETE /api/integrations/instagram
 * Disconnect the brand's IG account. Admin+.
 */
export async function DELETE() {
  const ctx = await getActiveMembership();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await requireBrandRole(ctx.brandId, "admin");
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json({ error: e.reason }, { status: 403 });
    throw e;
  }

  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any).from("brand_instagram_accounts").delete().eq("brand_id", ctx.brandId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from("brands")
    .update({ instagram_connected: false, instagram_connected_at: null })
    .eq("id", ctx.brandId);

  return NextResponse.json({ ok: true });
}

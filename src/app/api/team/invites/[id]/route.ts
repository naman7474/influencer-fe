import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveMembership, requireBrandRole, AuthorizationError } from "@/lib/auth/membership";

/**
 * DELETE /api/team/invite/[id]
 * Revoke a pending invite. Admin+.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const { error } = await svc
    .from("brand_invites")
    .delete()
    .eq("id", id)
    .eq("brand_id", ctx.brandId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

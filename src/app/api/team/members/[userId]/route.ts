import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveMembership, requireBrandRole, AuthorizationError, type MemberRole } from "@/lib/auth/membership";

const ROLES: MemberRole[] = ["owner", "admin", "member"];

/**
 * PATCH /api/team/members/[userId]
 * Change a member's role. Admin+ to demote/promote members. Only an owner
 * can promote a member to owner or demote another owner.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const ctx = await getActiveMembership();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { role?: MemberRole };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newRole = body.role;
  if (!newRole || !ROLES.includes(newRole))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  try {
    await requireBrandRole(ctx.brandId, "admin");
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json({ error: e.reason }, { status: 403 });
    throw e;
  }

  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: targetRow } = await (svc as any)
    .from("brand_members")
    .select("role")
    .eq("brand_id", ctx.brandId)
    .eq("user_id", userId)
    .maybeSingle();
  const target = targetRow as { role: MemberRole } | null;

  if (!target)
    return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Owner-only operations: anything that creates or removes an owner role.
  const ownerOnly =
    newRole === "owner" || target.role === "owner";
  if (ownerOnly && ctx.role !== "owner")
    return NextResponse.json({ error: "Only owners can change owner roles" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("brand_members")
    .update({ role: newRole })
    .eq("brand_id", ctx.brandId)
    .eq("user_id", userId);

  // The DB trigger enforces "≥1 owner" and will raise on demoting the last owner.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/team/members/[userId]
 * Remove a member. Admin+ can remove members. Only an owner can remove
 * another owner. The DB trigger guarantees the brand never loses its last owner.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
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
  const { data: targetRow } = await (svc as any)
    .from("brand_members")
    .select("role")
    .eq("brand_id", ctx.brandId)
    .eq("user_id", userId)
    .maybeSingle();
  const target = targetRow as { role: MemberRole } | null;

  if (!target)
    return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (target.role === "owner" && ctx.role !== "owner")
    return NextResponse.json({ error: "Only owners can remove owners" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("brand_members")
    .delete()
    .eq("brand_id", ctx.brandId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

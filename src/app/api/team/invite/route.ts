import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveMembership, requireBrandRole, AuthorizationError, type MemberRole } from "@/lib/auth/membership";
import { createInvite } from "@/lib/auth/team";
import { sendInviteEmail, inviteAcceptUrl } from "@/lib/auth/invite-email";

/**
 * GET /api/team/invite
 * List pending invites for active brand. Admin+.
 */
export async function GET() {
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
  const { data, error } = await svc
    .from("brand_invites")
    .select("id, email, role, invited_by, expires_at, created_at, display_name, token")
    .eq("brand_id", ctx.brandId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const invites = (data ?? []) as Array<{
    id: string;
    email: string;
    role: string;
    invited_by: string | null;
    expires_at: string;
    created_at: string;
    display_name: string | null;
    token: string;
  }>;
  return NextResponse.json({
    invites: invites.map((inv) => ({
      ...inv,
      // Don't leak the raw token to the response; UI uses invite_url only.
      token: undefined,
      invite_url: inviteAcceptUrl(inv.token),
    })),
  });
}

/**
 * POST /api/team/invite
 * Body: { email, role }
 * Creates an invite and emails the recipient. Admin+.
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

  let body: { email?: string; role?: MemberRole; display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? "member";
  const displayName = body.display_name?.trim() || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (!["owner", "admin", "member"].includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (role === "owner" && ctx.role !== "owner")
    return NextResponse.json({ error: "Only owners can invite owners" }, { status: 403 });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invite = await createInvite({
    brandId: ctx.brandId,
    email,
    role,
    invitedBy: user.id,
    displayName,
  });

  // Best-effort email send; do not block on failure (the invite is in the DB
  // and the inviter can copy the link from the UI to share manually).
  let emailDelivered = false;
  let emailError: string | null = null;
  try {
    const result = await sendInviteEmail({
      brandId: ctx.brandId,
      to: email,
      token: invite.token,
      invitedByName:
        (user.user_metadata as { full_name?: string })?.full_name ??
        user.email ??
        "A teammate",
    });
    emailDelivered = result.delivered;
    if (!result.delivered) emailError = result.reason ?? "unknown";
  } catch (err) {
    console.error("invite email failed", err);
    emailError = (err as Error).message;
  }

  return NextResponse.json({
    invite: { id: invite.id, email, role },
    invite_url: inviteAcceptUrl(invite.token),
    email_delivered: emailDelivered,
    email_error: emailError,
  });
}

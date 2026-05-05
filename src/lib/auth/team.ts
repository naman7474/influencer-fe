import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/auth/membership";

const INVITE_TTL_DAYS = 7;

export type Invite = {
  id: string;
  brand_id: string;
  email: string;
  role: MemberRole;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  display_name: string | null;
};

function generateToken() {
  return randomBytes(32).toString("hex");
}

function inviteExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TTL_DAYS);
  return d.toISOString();
}

/**
 * Create a brand invite. Re-uses an open invite for the same (brand, email)
 * if one exists, refreshing token + expiry.
 */
export async function createInvite(args: {
  brandId: string;
  email: string;
  role: MemberRole;
  invitedBy: string;
  displayName?: string | null;
}): Promise<Invite> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceRoleClient() as any;
  const email = args.email.trim().toLowerCase();
  const token = generateToken();
  const expires_at = inviteExpiry();

  const { data: existing } = await svc
    .from("brand_invites")
    .select("id")
    .eq("brand_id", args.brandId)
    .eq("email", email)
    .is("accepted_at", null)
    .maybeSingle();

  const displayName = args.displayName?.trim() || null;

  if (existing) {
    const { data, error } = await svc
      .from("brand_invites")
      .update({
        role: args.role,
        token,
        expires_at,
        invited_by: args.invitedBy,
        display_name: displayName,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as Invite;
  }

  const { data, error } = await svc
    .from("brand_invites")
    .insert({
      brand_id: args.brandId,
      email,
      role: args.role,
      token,
      expires_at,
      invited_by: args.invitedBy,
      display_name: displayName,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Invite;
}

export type ConsumeResult =
  | { ok: true; brandId: string; role: MemberRole }
  | { ok: false; reason: "not_found" | "expired" | "already_accepted" | "email_mismatch" };

/**
 * Consume an invite token: validates, inserts brand_members row, marks
 * accepted. Email check is enforced — the invite email must match the
 * accepting user's email.
 */
export async function consumeInvite(args: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<ConsumeResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceRoleClient() as any;
  const { data: invite } = await svc
    .from("brand_invites")
    .select("*")
    .eq("token", args.token)
    .maybeSingle();

  if (!invite) return { ok: false, reason: "not_found" };
  if (invite.accepted_at) return { ok: false, reason: "already_accepted" };
  if (new Date(invite.expires_at).getTime() < Date.now())
    return { ok: false, reason: "expired" };
  if (invite.email.toLowerCase() !== args.userEmail.toLowerCase())
    return { ok: false, reason: "email_mismatch" };

  const { error: memberErr } = await svc
    .from("brand_members")
    .upsert(
      {
        brand_id: invite.brand_id,
        user_id: args.userId,
        role: invite.role,
        invited_by: invite.invited_by,
      },
      { onConflict: "brand_id,user_id" }
    );
  if (memberErr) throw memberErr;

  // Stamp the inviter-provided display_name onto the new profile, but only
  // if the user doesn't already have one set (don't overwrite a real choice).
  const { data: existingProfile } = await svc
    .from("profiles")
    .select("display_name")
    .eq("id", args.userId)
    .maybeSingle();
  const profilePayload: { id: string; display_name?: string } = { id: args.userId };
  if (
    invite.display_name &&
    !(existingProfile as { display_name: string | null } | null)?.display_name
  ) {
    profilePayload.display_name = invite.display_name;
  }
  await svc.from("profiles").upsert(profilePayload, { onConflict: "id" });

  await svc
    .from("brand_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return { ok: true, brandId: invite.brand_id, role: invite.role as MemberRole };
}

export async function getInviteByToken(token: string): Promise<Invite | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceRoleClient() as any;
  const { data } = await svc
    .from("brand_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return (data as Invite) ?? null;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceRoleClient() as any;
  await svc.from("brand_invites").delete().eq("id", inviteId);
}

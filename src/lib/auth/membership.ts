import { cache } from "react";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export type MemberRole = "owner" | "admin" | "member";

const ROLE_RANK: Record<MemberRole, number> = { member: 0, admin: 1, owner: 2 };

export type MembershipContext = {
  userId: string;
  brandId: string;
  role: MemberRole;
};

/**
 * Returns the authenticated user's primary brand membership, or null if
 * the user has no memberships (or is unauthenticated).
 *
 * Selection rule: prefer 'owner', then 'admin', then most recent.
 * Cached per request via React `cache()`.
 */
export const getActiveMembership = cache(
  async (): Promise<MembershipContext | null> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const svc = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc as any)
      .from("brand_members")
      .select("brand_id, role, created_at")
      .eq("user_id", user.id);

    const rows = (data ?? []) as Array<{
      brand_id: string;
      role: MemberRole;
      created_at: string;
    }>;
    if (!rows.length) return null;

    const sorted = [...rows].sort((a, b) => {
      const r = ROLE_RANK[b.role] - ROLE_RANK[a.role];
      if (r !== 0) return r;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return {
      userId: user.id,
      brandId: sorted[0].brand_id,
      role: sorted[0].role,
    };
  }
);

/**
 * Resolve the authenticated user's role on a specific brand.
 * Returns null if the user is not a member.
 */
export const getBrandRole = cache(
  async (brandId: string): Promise<MemberRole | null> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const svc = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc as any)
      .from("brand_members")
      .select("role")
      .eq("brand_id", brandId)
      .eq("user_id", user.id)
      .maybeSingle();

    return ((data as { role: MemberRole } | null)?.role) ?? null;
  }
);

export function hasRoleAtLeast(actual: MemberRole, min: MemberRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[min];
}

export class AuthorizationError extends Error {
  constructor(public reason: "unauthenticated" | "not_member" | "insufficient_role") {
    super(reason);
    this.name = "AuthorizationError";
  }
}

/**
 * Throw if the caller is not a member of `brandId` with at least `minRole`.
 * Returns the user's role on success.
 */
export async function requireBrandRole(
  brandId: string,
  minRole: MemberRole = "member"
): Promise<{ userId: string; role: MemberRole }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthorizationError("unauthenticated");

  const role = await getBrandRole(brandId);
  if (!role) throw new AuthorizationError("not_member");
  if (!hasRoleAtLeast(role, minRole))
    throw new AuthorizationError("insufficient_role");

  return { userId: user.id, role };
}

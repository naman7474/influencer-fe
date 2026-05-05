import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/membership";

/**
 * GET /api/team/members
 * Lists members of the caller's active brand. Any member can list.
 */
export async function GET() {
  const ctx = await getActiveMembership();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membersRaw, error } = await (svc as any)
    .from("brand_members")
    .select("user_id, role, created_at, invited_by")
    .eq("brand_id", ctx.brandId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members = (membersRaw ?? []) as Array<{
    user_id: string;
    role: string;
    created_at: string;
    invited_by: string | null;
  }>;
  const userIds = members.map((m) => m.user_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profilesRaw } = await (svc as any)
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  const profiles = (profilesRaw ?? []) as Array<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;

  // Email lookup via auth admin API
  const emailById: Record<string, string | undefined> = {};
  for (const id of userIds) {
    const { data } = await svc.auth.admin.getUserById(id);
    if (data?.user) emailById[id] = data.user.email ?? undefined;
  }

  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return NextResponse.json({
    members: members.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      joined_at: m.created_at,
      invited_by: m.invited_by,
      display_name: profileById[m.user_id]?.display_name ?? null,
      avatar_url: profileById[m.user_id]?.avatar_url ?? null,
      email: emailById[m.user_id] ?? null,
    })),
  });
}

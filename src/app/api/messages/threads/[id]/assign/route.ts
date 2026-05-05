import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/membership";

/**
 * PATCH /api/messages/threads/[id]/assign
 * Body: { user_id: string | null }
 *
 * Assigns the thread to a teammate (or unassigns if null). Requires the
 * caller to be a member of the thread's brand. The assignee must also be
 * a member of the same brand — otherwise we'd leak threads to outsiders.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getActiveMembership();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { user_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const svc = createServiceRoleClient();

  // Verify the thread belongs to the caller's active brand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: threadRow } = await (svc as any)
    .from("message_threads")
    .select("id, brand_id")
    .eq("id", id)
    .maybeSingle();
  const thread = threadRow as { id: string; brand_id: string } | null;
  if (!thread || thread.brand_id !== ctx.brandId)
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const assigneeId = body.user_id ?? null;
  if (assigneeId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member } = await (svc as any)
      .from("brand_members")
      .select("user_id")
      .eq("brand_id", ctx.brandId)
      .eq("user_id", assigneeId)
      .maybeSingle();
    if (!member)
      return NextResponse.json(
        { error: "Assignee must be a member of this brand" },
        { status: 400 }
      );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("message_threads")
    .update({ assigned_to_user_id: assigneeId })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, assigned_to_user_id: assigneeId });
}

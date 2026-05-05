import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncBrandDms } from "@/lib/instagram/sync-dms";

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // when unset, allow (dev only)
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

/**
 * POST /api/cron/instagram/sync
 * Vercel cron entrypoint. Iterates connected business accounts and pulls
 * recent conversations. Personal accounts are skipped here (they sync via
 * the worker route, not yet wired).
 */
export async function POST(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: accountsRaw } = await (svc as any)
    .from("brand_instagram_accounts")
    .select("brand_id, account_type")
    .eq("account_type", "business");

  const accounts = (accountsRaw ?? []) as Array<{ brand_id: string; account_type: string }>;
  const results: Array<{ brand_id: string; ok: boolean; threads: number; messages: number; reason?: string }> = [];

  for (const a of accounts) {
    try {
      const r = await syncBrandDms(a.brand_id);
      results.push({ brand_id: a.brand_id, ...r });
    } catch (e) {
      results.push({
        brand_id: a.brand_id,
        ok: false,
        threads: 0,
        messages: 0,
        reason: (e as Error).message,
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

export const GET = POST; // allow cron triggers that use GET

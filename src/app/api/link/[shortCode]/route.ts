import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

/**
 * GET /api/link/[shortCode]
 * UTM link redirect + click tracking. Public endpoint — no auth needed.
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params;
  const supabase = getServiceClient();

  // Look up the link
  const { data: link } = await supabase
    .from("campaign_utm_links")
    .select("id, full_url")
    .eq("short_code", shortCode)
    .single();

  if (!link || !link.full_url) {
    return new Response("Not found", { status: 404 });
  }

  // Increment click count (fire and forget)
  supabase.rpc("increment_utm_clicks", { p_link_id: link.id }).then();

  // Log individual click
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ipHash = createHmac("sha256", "click-salt")
    .update(forwardedFor)
    .digest("hex")
    .slice(0, 16);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any)
    .from("utm_click_events")
    .insert({
      utm_link_id: link.id,
      user_agent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
      ip_hash: ipHash,
    })
    .then();

  // 302 redirect to full URL
  return new Response(null, {
    status: 302,
    headers: { Location: link.full_url },
  });
}

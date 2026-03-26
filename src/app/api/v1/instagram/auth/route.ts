import { NextResponse } from "next/server";
import { buildInstagramOAuthUrl } from "@/lib/instagram";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

const INSTAGRAM_STATE_COOKIE = "instagram_oauth_state";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);
  const state = crypto.randomUUID();
  const payload = Buffer.from(
    JSON.stringify({
      brand_id: brand.brand_id,
      state,
    })
  ).toString("base64url");

  const response = NextResponse.redirect(buildInstagramOAuthUrl(state));
  response.cookies.set(INSTAGRAM_STATE_COOKIE, payload, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}

import { NextResponse } from "next/server";
import {
  exchangeInstagramToken,
  getInstagramBusinessAccount,
} from "@/lib/instagram";
import { triggerInstagramSyncJob } from "@/lib/jobs";
import { createServiceRoleClient } from "@/lib/supabase/server";

const INSTAGRAM_STATE_COOKIE = "instagram_oauth_state";
export const runtime = "nodejs";

function decodeStateCookie(value: string | undefined): { brand_id: string; state: string } | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const redirectUrl = new URL("/settings", request.url);
  const cookieValue = request.headers
    .get("cookie")
    ?.split("; ")
    .find((cookie) => cookie.startsWith(`${INSTAGRAM_STATE_COOKIE}=`))
    ?.split("=")[1];
  const statePayload = decodeStateCookie(cookieValue);

  if (!code || !statePayload || statePayload.state !== state) {
    redirectUrl.searchParams.set("instagram", "error");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const token = await exchangeInstagramToken(code);
    const account = await getInstagramBusinessAccount(token.access_token);
    const serviceRole = createServiceRoleClient();
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

    const brandUpdate = await serviceRole
      .from("brands")
      .update({
        instagram_connected: true,
        instagram_connected_at: new Date().toISOString(),
      })
      .eq("id", statePayload.brand_id);

    if (brandUpdate.error) {
      throw brandUpdate.error;
    }

    const accountUpsert = await serviceRole
      .from("brand_instagram_accounts")
      .upsert(
        {
          brand_id: statePayload.brand_id,
          ig_user_id: account.ig_user_id,
          page_id: account.page_id,
          access_token: token.access_token,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "brand_id" }
      )
      .select("*")
      .single();

    if (accountUpsert.error) {
      throw accountUpsert.error;
    }

    await triggerInstagramSyncJob(statePayload.brand_id, {
      instagram_account_id: accountUpsert.data.id,
    });

    redirectUrl.searchParams.set("instagram", "connected");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(INSTAGRAM_STATE_COOKIE);
    return response;
  } catch {
    redirectUrl.searchParams.set("instagram", "error");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(INSTAGRAM_STATE_COOKIE);
    return response;
  }
}

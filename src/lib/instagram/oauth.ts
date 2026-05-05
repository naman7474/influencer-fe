import { graphGet, GRAPH_BASE } from "@/lib/instagram/graph";

const META_OAUTH_AUTHORIZE = "https://www.facebook.com/v21.0/dialog/oauth";

export const META_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_messaging",
  "business_management",
];

function getAppCreds() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET must be set.");
  }
  return { appId, appSecret };
}

export function buildMetaAuthUrl(redirectUri: string, state: string): string {
  const { appId } = getAppCreds();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: META_SCOPES.join(","),
  });
  return `${META_OAUTH_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const { appId, appSecret } = getAppCreds();
  const data = await graphGet<{ access_token: string; expires_in?: number }>(
    "/oauth/access_token",
    {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }
  );
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 0 };
}

/**
 * Exchange a short-lived user access token for a long-lived one (~60 days).
 */
export async function getLongLivedToken(
  shortToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const { appId, appSecret } = getAppCreds();
  const data = await graphGet<{ access_token: string; expires_in: number }>(
    "/oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    }
  );
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Refresh a long-lived token. Tokens are refreshable indefinitely as long
 * as they're refreshed before they expire.
 */
export async function refreshLongLivedToken(currentToken: string) {
  return getLongLivedToken(currentToken);
}

export type IgBusinessLink = {
  metaUserId: string;
  pageId: string;
  pageAccessToken: string;
  igBusinessAccountId: string;
  igUsername: string;
};

/**
 * After exchanging a user access token, locate the connected IG Business
 * Account: list the user's Pages → pick the one with an instagram_business_account.
 *
 * For multi-page users we just pick the first match for now; a future
 * enhancement can present a chooser.
 */
export async function resolveIgBusinessLink(
  userAccessToken: string
): Promise<IgBusinessLink | null> {
  const me = await graphGet<{ id: string }>(`/me`, {
    fields: "id",
    access_token: userAccessToken,
  });

  const pages = await graphGet<{
    data: Array<{ id: string; access_token: string; name: string }>;
  }>(`/me/accounts`, {
    fields: "id,name,access_token",
    access_token: userAccessToken,
  });

  for (const page of pages.data ?? []) {
    try {
      const linked = await graphGet<{
        instagram_business_account?: { id: string; username?: string };
      }>(`/${page.id}`, {
        fields: "instagram_business_account{id,username}",
        access_token: page.access_token,
      });
      if (linked.instagram_business_account?.id) {
        return {
          metaUserId: me.id,
          pageId: page.id,
          pageAccessToken: page.access_token,
          igBusinessAccountId: linked.instagram_business_account.id,
          igUsername: linked.instagram_business_account.username ?? "",
        };
      }
    } catch {
      // continue
    }
  }
  return null;
}

export { GRAPH_BASE };

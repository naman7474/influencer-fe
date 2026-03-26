const FACEBOOK_GRAPH_BASE_URL = "https://graph.facebook.com/v23.0";

export function buildInstagramOAuthUrl(state: string): string {
  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!appId || !redirectUri) {
    throw new Error("Missing Instagram OAuth environment variables.");
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope: [
      "instagram_basic",
      "instagram_manage_messages",
      "pages_messaging",
      "pages_read_engagement",
    ].join(","),
  });

  return `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeInstagramToken(code: string): Promise<{
  access_token: string;
  expires_in: number | null;
}> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Missing Instagram OAuth credentials.");
  }

  const shortLivedUrl = new URL(`${FACEBOOK_GRAPH_BASE_URL}/oauth/access_token`);
  shortLivedUrl.searchParams.set("client_id", appId);
  shortLivedUrl.searchParams.set("client_secret", appSecret);
  shortLivedUrl.searchParams.set("redirect_uri", redirectUri);
  shortLivedUrl.searchParams.set("code", code);

  const shortLivedResponse = await fetch(shortLivedUrl, { cache: "no-store" });
  if (!shortLivedResponse.ok) {
    throw new Error(
      `Instagram short-lived token exchange failed with status ${shortLivedResponse.status}.`
    );
  }

  const shortLivedPayload = (await shortLivedResponse.json()) as {
    access_token?: string;
  };

  if (!shortLivedPayload.access_token) {
    throw new Error("Instagram token exchange returned no access token.");
  }

  const longLivedUrl = new URL(`${FACEBOOK_GRAPH_BASE_URL}/oauth/access_token`);
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", appId);
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", shortLivedPayload.access_token);

  const longLivedResponse = await fetch(longLivedUrl, { cache: "no-store" });
  if (!longLivedResponse.ok) {
    throw new Error(
      `Instagram long-lived token exchange failed with status ${longLivedResponse.status}.`
    );
  }

  const longLivedPayload = (await longLivedResponse.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!longLivedPayload.access_token) {
    throw new Error("Instagram long-lived token exchange returned no token.");
  }

  return {
    access_token: longLivedPayload.access_token,
    expires_in: longLivedPayload.expires_in ?? null,
  };
}

export async function getInstagramBusinessAccount(accessToken: string): Promise<{
  page_id: string;
  ig_user_id: string;
}> {
  const url = new URL(`${FACEBOOK_GRAPH_BASE_URL}/me/accounts`);
  url.searchParams.set("fields", "id,name,instagram_business_account{id}");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Instagram account lookup failed with status ${response.status}.`
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{
      id?: string;
      instagram_business_account?: { id?: string };
    }>;
  };

  const page = payload.data?.find((entry) => entry.instagram_business_account?.id);
  const pageId = page?.id;
  const igUserId = page?.instagram_business_account?.id;

  if (!pageId || !igUserId) {
    throw new Error("No Instagram Business account found for this Facebook login.");
  }

  return {
    page_id: pageId,
    ig_user_id: igUserId,
  };
}

export async function refreshInstagramToken(token: string): Promise<{
  access_token: string;
  expires_in: number | null;
}> {
  const url = new URL(`${FACEBOOK_GRAPH_BASE_URL}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Instagram token refresh failed with status ${response.status}.`
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error("Instagram token refresh returned no access token.");
  }

  return {
    access_token: payload.access_token,
    expires_in: payload.expires_in ?? null,
  };
}

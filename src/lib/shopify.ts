const SHOPIFY_STORE_PATTERN =
  /^(https?:\/\/)?([a-zA-Z0-9][a-zA-Z0-9-]*)\.myshopify\.com\/?$/i;

export function normalizeShopifyStoreUrl(input: string): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  const match = value.match(SHOPIFY_STORE_PATTERN);
  if (!match) {
    return null;
  }

  return `${match[2].toLowerCase()}.myshopify.com`;
}

export function getShopifyScopes(): string {
  return process.env.SHOPIFY_SCOPES ??
    "read_orders,read_analytics,read_products,read_shipping";
}

export function buildShopifyOAuthUrl(shopDomain: string, state: string): string {
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!redirectUri || !clientId) {
    throw new Error("Missing Shopify OAuth environment variables.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: getShopifyScopes(),
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

export async function exchangeShopifyAccessToken(
  shopDomain: string,
  code: string
): Promise<string> {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Shopify client credentials.");
  }

  const response = await fetch(
    `https://${shopDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Shopify token exchange failed with status ${response.status}.`
    );
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Shopify token exchange returned no access token.");
  }

  return payload.access_token;
}

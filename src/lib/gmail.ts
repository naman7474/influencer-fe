/* ------------------------------------------------------------------ */
/*  Gmail API — Direct Google OAuth Integration                        */
/*  Each brand stores their own OAuth refresh + access tokens.         */
/*  Uses Gmail REST API v1 directly (no Composio).                     */
/* ------------------------------------------------------------------ */

import { createServerSupabaseClient } from "@/lib/supabase/server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Refresh the access token 5 minutes before expiry */
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Google OAuth helpers                                               */
/* ------------------------------------------------------------------ */

function getGoogleClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.");
  }
  return { clientId, clientSecret };
}

/**
 * Build the Google OAuth consent URL.
 */
export function buildGoogleOAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = getGoogleClientCredentials();
  const scopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const { clientId, clientSecret } = getGoogleClientCredentials();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh an expired access token using the refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const { clientId, clientSecret } = getGoogleClientCredentials();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/* ------------------------------------------------------------------ */
/*  Credential persistence & retrieval                                 */
/* ------------------------------------------------------------------ */

/**
 * Save Gmail OAuth tokens after initial connect.
 */
export async function saveGmailTokens(
  brandId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  email: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  await supabase
    .from("brands")
    .update({
      gmail_access_token: accessToken,
      gmail_refresh_token: refreshToken,
      gmail_token_expires_at: expiresAt,
      gmail_connected: true,
      gmail_email: email,
    } as never)
    .eq("id", brandId);
}

/**
 * Get a valid Gmail access token for a brand.
 * Auto-refreshes if expired.
 */
async function getGmailAccessToken(brandId: string): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data: brandRow } = await supabase
    .from("brands")
    .select("gmail_access_token, gmail_refresh_token, gmail_token_expires_at")
    .eq("id", brandId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brand = brandRow as any;
  if (!brand?.gmail_refresh_token) {
    throw new Error("Gmail not connected. Please connect Gmail in Settings.");
  }

  // Check if token needs refresh
  const expiresAt = brand.gmail_token_expires_at
    ? new Date(brand.gmail_token_expires_at).getTime()
    : 0;
  const needsRefresh =
    !brand.gmail_access_token || Date.now() > expiresAt - TOKEN_BUFFER_MS;

  if (needsRefresh) {
    const refreshed = await refreshAccessToken(brand.gmail_refresh_token);
    const newExpiresAt = new Date(
      Date.now() + refreshed.expiresIn * 1000
    ).toISOString();

    await supabase
      .from("brands")
      .update({
        gmail_access_token: refreshed.accessToken,
        gmail_token_expires_at: newExpiresAt,
      } as never)
      .eq("id", brandId);

    return refreshed.accessToken;
  }

  return brand.gmail_access_token;
}

/* ------------------------------------------------------------------ */
/*  Gmail API operations                                               */
/* ------------------------------------------------------------------ */

/**
 * Send an email via Gmail API.
 */
export async function sendEmail(
  brandId: string,
  params: {
    to: string;
    subject: string;
    body: string;
    replyToMessageId?: string;
    threadId?: string;
  }
): Promise<{ messageId: string; threadId: string }> {
  const accessToken = await getGmailAccessToken(brandId);

  // Build RFC 2822 MIME message
  const headers = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
  ];

  if (params.replyToMessageId) {
    headers.push(`In-Reply-To: ${params.replyToMessageId}`);
    headers.push(`References: ${params.replyToMessageId}`);
  }

  const rawMessage = headers.join("\r\n") + "\r\n\r\n" + params.body;

  // Base64url encode the message
  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestBody: any = { raw: encoded };
  if (params.threadId) {
    requestBody.threadId = params.threadId;
  }

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    messageId: data.id || "",
    threadId: data.threadId || "",
  };
}

/**
 * Get a Gmail thread by thread ID.
 */
export async function getEmailThread(
  brandId: string,
  threadId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const accessToken = await getGmailAccessToken(brandId);

  const res = await fetch(`${GMAIL_API}/threads/${threadId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail get thread failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Search emails in Gmail.
 */
export async function searchEmails(
  brandId: string,
  query: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const accessToken = await getGmailAccessToken(brandId);

  const params = new URLSearchParams({
    q: query,
    maxResults: "50",
  });

  const res = await fetch(`${GMAIL_API}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.messages || [];
}

/**
 * Get the Gmail profile (email address) for a connected account.
 */
export async function getGmailProfile(
  brandId: string
): Promise<{ emailAddress: string }> {
  const accessToken = await getGmailAccessToken(brandId);

  const res = await fetch(`${GMAIL_API}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail profile failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { emailAddress: data.emailAddress || "" };
}

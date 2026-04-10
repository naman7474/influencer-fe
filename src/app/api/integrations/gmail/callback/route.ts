import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeGoogleCode, saveGmailTokens, getGmailProfile } from "@/lib/gmail";

/**
 * Returns an HTML page that posts a message to the opener window and closes.
 */
function popupResponse(type: "gmail_connected" | "gmail_error", error?: string) {
  const message = JSON.stringify(
    type === "gmail_connected"
      ? { type: "gmail_connected" }
      : { type: "gmail_error", error: error || "Unknown error" }
  );

  const html = `<!DOCTYPE html>
<html><head><title>Gmail Connected</title></head>
<body>
<p>Connecting Gmail&hellip; you can close this tab.</p>
<script>
  if (window.opener) {
    window.opener.postMessage(${message}, window.location.origin);
  }
  window.close();
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * GET /api/integrations/gmail/callback
 * Google redirects here (in the popup tab) after the user consents.
 * Exchanges the code for tokens, saves them, then posts a message
 * back to the opener window and closes the tab.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Google returned an error (user denied, etc.)
  if (errorParam) {
    return popupResponse("gmail_error", errorParam);
  }

  if (!code || !state) {
    return popupResponse("gmail_error", "Missing OAuth parameters from Google.");
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get("gmail_oauth_state")?.value;
  const brandId = cookieStore.get("gmail_oauth_brand_id")?.value;

  if (!savedState || savedState !== state) {
    return popupResponse("gmail_error", "OAuth state mismatch. Please try again.");
  }

  if (!brandId) {
    return popupResponse("gmail_error", "Session expired. Please try connecting again.");
  }

  // Clear one-time cookies
  cookieStore.delete("gmail_oauth_state");
  cookieStore.delete("gmail_oauth_brand_id");

  try {
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/integrations/gmail/callback`;

    // Exchange authorization code for tokens
    const tokens = await exchangeGoogleCode(code, redirectUri);

    // Save tokens first so getGmailProfile can use them
    await saveGmailTokens(
      brandId,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn,
      ""
    );

    // Fetch the user's Gmail address
    let email = "";
    try {
      const profile = await getGmailProfile(brandId);
      email = profile.emailAddress;
    } catch {
      // Profile fetch may fail; still mark as connected
    }

    // Update with the email address
    if (email) {
      await saveGmailTokens(
        brandId,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresIn,
        email
      );
    }

    return popupResponse("gmail_connected");
  } catch (err) {
    console.error("Gmail callback error:", err);
    return popupResponse("gmail_error", "Failed to complete Gmail connection. Please try again.");
  }
}

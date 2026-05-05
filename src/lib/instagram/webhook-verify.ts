import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta GET-handshake verification for webhook subscription endpoint.
 * Returns the challenge string to echo back, or null if verification fails.
 */
export function verifySubscription(searchParams: URLSearchParams): string | null {
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!expected) return null;
  if (mode !== "subscribe" || verifyToken !== expected || !challenge) return null;
  return challenge;
}

/**
 * Validate the X-Hub-Signature-256 HMAC against the raw request body.
 * Throws if invalid; returns silently on success.
 */
export function verifyWebhookSignature(rawBody: string, headerSig: string | null) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) throw new Error("META_APP_SECRET not set");
  if (!headerSig?.startsWith("sha256="))
    throw new Error("missing or malformed X-Hub-Signature-256");

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = headerSig.slice("sha256=".length);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new Error("invalid webhook signature");
}

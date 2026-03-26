import { createHmac, timingSafeEqual } from "node:crypto";

interface SendEmailInput {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

interface ResendWebhookHeaders {
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
}

export async function sendEmail({
  to,
  from,
  subject,
  html,
  replyTo,
  headers,
}: SendEmailInput): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const defaultFrom = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  if (!from && !defaultFrom) {
    throw new Error("Missing RESEND_FROM_EMAIL.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from ?? defaultFrom,
      to,
      subject,
      html,
      reply_to: replyTo,
      headers,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Resend send failed with status ${response.status}: ${message}`
    );
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error("Resend send did not return a message id.");
  }

  return payload.id;
}

export function buildReplyToAddress(outreachMessageId: string): string {
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN;
  if (!inboundDomain) {
    throw new Error("Missing RESEND_INBOUND_DOMAIN.");
  }

  return `reply-${outreachMessageId}@${inboundDomain}`;
}

export function extractReplyMessageId(addresses: string | string[] | null | undefined) {
  const values = Array.isArray(addresses) ? addresses : [addresses];
  for (const value of values) {
    const normalized = String(value ?? "").trim().toLowerCase();
    const match = normalized.match(/reply-([0-9a-f-]{36})@/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function getSvixHeaders(headers: Headers): ResendWebhookHeaders {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Missing Svix webhook headers.");
  }

  return {
    svixId,
    svixTimestamp,
    svixSignature,
  };
}

export function verifySvixSignature(
  payload: string,
  headers: ResendWebhookHeaders
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing RESEND_WEBHOOK_SECRET.");
  }

  const encodedSecret = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  const key = Buffer.from(encodedSecret, "base64");
  const signedContent = `${headers.svixId}.${headers.svixTimestamp}.${payload}`;
  const digest = createHmac("sha256", key).update(signedContent).digest("base64");
  const expected = Buffer.from(digest);

  return headers.svixSignature
    .split(" ")
    .map((entry) => entry.trim())
    .some((entry) => {
      const [, signature] = entry.split(",");
      if (!signature) {
        return false;
      }
      const actual = Buffer.from(signature);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
}

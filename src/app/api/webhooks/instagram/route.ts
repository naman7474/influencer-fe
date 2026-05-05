import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifySubscription, verifyWebhookSignature } from "@/lib/instagram/webhook-verify";
import { handleInboundIgMessage } from "@/lib/instagram/inbound";

/**
 * GET /api/webhooks/instagram
 * Meta subscription handshake. Echoes hub.challenge when verify_token matches.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const challenge = verifySubscription(url.searchParams);
  if (challenge === null)
    return NextResponse.json({ error: "verify failed" }, { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

type IgWebhookEntry = {
  id: string;                        // IG Business Account id
  time: number;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: { mid: string; text?: string; is_echo?: boolean };
  }>;
};

type IgWebhookPayload = {
  object: string;
  entry: IgWebhookEntry[];
};

/**
 * POST /api/webhooks/instagram
 * Receives `messages` events from Meta. Each event is mapped to one of our
 * connected brands by ig_business_account_id, then routed to handleInboundIgMessage.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  try {
    verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"));
  } catch (e) {
    console.warn("ig webhook signature failed", (e as Error).message);
    return NextResponse.json({ error: "bad signature" }, { status: 403 });
  }

  let payload: IgWebhookPayload;
  try {
    payload = JSON.parse(raw) as IgWebhookPayload;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (payload.object !== "instagram") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const svc = createServiceRoleClient();

  for (const entry of payload.entry ?? []) {
    const igBusinessId = entry.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: accountRow } = await (svc as any)
      .from("brand_instagram_accounts")
      .select("id, brand_id, ig_business_account_id")
      .eq("ig_business_account_id", igBusinessId)
      .maybeSingle();
    const account = accountRow as
      | { id: string; brand_id: string; ig_business_account_id: string }
      | null;
    if (!account) continue;

    for (const m of entry.messaging ?? []) {
      // Skip echoes (messages we sent ourselves)
      if (m.message?.is_echo) continue;
      // Skip non-text events (e.g. read receipts) for now
      if (!m.message?.text || !m.message.mid) continue;
      // Skip outbound (sender is the IG Business itself)
      if (m.sender.id === igBusinessId) continue;

      try {
        await handleInboundIgMessage({
          brandId: account.brand_id,
          instagramAccountId: account.id,
          senderId: m.sender.id,
          senderHandle: null, // resolved later via Graph API in inbound.ts if needed
          senderName: null,
          body: m.message.text,
          providerMessageId: m.message.mid,
          createdAt: new Date(m.timestamp).toISOString(),
          rawPayload: m as unknown as Record<string, unknown>,
        });
      } catch (e) {
        console.error("ig inbound handler failed", e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

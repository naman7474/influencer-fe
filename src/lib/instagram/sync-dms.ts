import { createServiceRoleClient } from "@/lib/supabase/server";
import { graphGet } from "@/lib/instagram/graph";
import { decryptToken } from "@/lib/instagram/token-encryption";
import { handleInboundIgMessage } from "@/lib/instagram/inbound";

type Message = {
  id: string;
  from: { id: string; username?: string };
  to: { data: Array<{ id: string; username?: string }> };
  message: string;
  created_time: string;
};

type Conversation = {
  id: string;
  participants: { data: Array<{ id: string; username?: string; name?: string }> };
  messages?: { data: Message[] };
  updated_time: string;
};

/**
 * Pull recent IG conversations + messages for one connected brand and
 * upsert them into our message_threads / outreach_messages tables.
 *
 * Business accounts use the Graph API (`/{ig_business}/conversations`).
 * Personal accounts return early — they sync via the worker route, not here.
 */
export async function syncBrandDms(brandId: string): Promise<{
  ok: boolean;
  threads: number;
  messages: number;
  reason?: string;
}> {
  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: accountRow } = await (svc as any)
    .from("brand_instagram_accounts")
    .select(
      "id, account_type, ig_business_account_id, access_token, last_dm_sync_at"
    )
    .eq("brand_id", brandId)
    .maybeSingle();

  const account = accountRow as
    | {
        id: string;
        account_type: "business" | "personal";
        ig_business_account_id: string;
        access_token: string;
        last_dm_sync_at: string | null;
      }
    | null;

  if (!account) return { ok: false, threads: 0, messages: 0, reason: "no_account" };
  if (account.account_type !== "business")
    return { ok: false, threads: 0, messages: 0, reason: "personal_uses_worker" };

  const token = decryptToken(account.access_token);
  const since = account.last_dm_sync_at
    ? Math.floor(new Date(account.last_dm_sync_at).getTime() / 1000)
    : 0;

  const data = await graphGet<{ data: Conversation[] }>(
    `/${account.ig_business_account_id}/conversations`,
    {
      platform: "instagram",
      fields:
        "participants{id,username,name},updated_time," +
        "messages.limit(20){id,from,to,message,created_time}",
      access_token: token,
      ...(since ? { since: String(since) } : {}),
    }
  );

  let threadCount = 0;
  let messageCount = 0;

  for (const convo of data.data ?? []) {
    threadCount++;
    for (const m of convo.messages?.data ?? []) {
      const isOutbound = m.from.id === account.ig_business_account_id;
      if (isOutbound) continue; // we already record outbound on send
      const counterparty = convo.participants.data.find(
        (p) => p.id !== account.ig_business_account_id
      );
      await handleInboundIgMessage({
        brandId,
        instagramAccountId: account.id,
        senderId: m.from.id,
        senderHandle: counterparty?.username ?? null,
        senderName: counterparty?.name ?? null,
        body: m.message,
        providerMessageId: m.id,
        createdAt: m.created_time,
        rawPayload: convo as unknown as Record<string, unknown>,
      });
      messageCount++;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any)
    .from("brand_instagram_accounts")
    .update({ last_dm_sync_at: new Date().toISOString() })
    .eq("id", account.id);

  return { ok: true, threads: threadCount, messages: messageCount };
}

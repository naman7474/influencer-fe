import { createServiceRoleClient } from "@/lib/supabase/server";
import { graphGet } from "@/lib/instagram/graph";
import { decryptToken } from "@/lib/instagram/token-encryption";

type InboundArgs = {
  brandId: string;
  instagramAccountId: string;
  senderId: string;             // IG-scoped user id (PSID)
  senderHandle: string | null;  // IG @handle
  senderName: string | null;
  body: string;
  providerMessageId: string;
  createdAt: string;            // ISO
  rawPayload: Record<string, unknown>;
};

/**
 * Idempotently record an inbound IG DM:
 *   1. Upsert inbound_creators (the bridge row)
 *   2. Find/create the public.creators row by handle (no scrape data yet)
 *   3. Find/create the message_thread for (brand, creator)
 *   4. Insert the outreach_message (direction='inbound', channel='instagram_dm')
 *   5. If creator is brand-new and account is public, enqueue creator_ig_scrape
 *
 * Idempotency relies on the unique index on (channel, provider_message_id).
 */
export async function handleInboundIgMessage(args: InboundArgs): Promise<{
  threadId: string;
  messageId: string | null;
  scraped: boolean;
}> {
  const svc = createServiceRoleClient();

  // 1. inbound_creators row (bridge, per migration 019)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inboundRow } = await (svc as any)
    .from("inbound_creators")
    .upsert(
      {
        brand_id: args.brandId,
        instagram_account_id: args.instagramAccountId,
        sender_id: args.senderId,
        sender_handle: args.senderHandle,
        sender_name: args.senderName,
        message_preview: args.body.slice(0, 200),
        last_message_at: args.createdAt,
        raw_thread: args.rawPayload,
      },
      { onConflict: "brand_id,sender_id" }
    )
    .select("id, linked_creator_id, status")
    .single();

  const inbound = inboundRow as {
    id: string;
    linked_creator_id: string | null;
    status: string;
  } | null;
  if (!inbound) throw new Error("inbound_creators upsert failed");

  // 2. Resolve creators row by handle (if we know the handle)
  let creatorId = inbound.linked_creator_id;
  let createdNewCreator = false;

  if (!creatorId && args.senderHandle) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingCreator } = await (svc as any)
      .from("creators")
      .select("id")
      .eq("handle", args.senderHandle)
      .maybeSingle();

    if (existingCreator) {
      creatorId = (existingCreator as { id: string }).id;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newCreator } = await (svc as any)
        .from("creators")
        .insert({
          handle: args.senderHandle,
          display_name: args.senderName,
          source: "instagram_dm_inbound",
          source_brand_id: args.brandId,
          source_inbound_id: inbound.id,
        })
        .select("id")
        .single();
      const nc = newCreator as { id: string } | null;
      creatorId = nc?.id ?? null;
      createdNewCreator = !!nc;
    }

    if (creatorId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc as any)
        .from("inbound_creators")
        .update({ linked_creator_id: creatorId })
        .eq("id", inbound.id);
    }
  }

  if (!creatorId) {
    // Cannot anchor a thread without a creator. Bail gracefully — the
    // inbound row is still recorded for ops to triage manually.
    return { threadId: "", messageId: null, scraped: false };
  }

  // 3. message_threads upsert
  let threadId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingThread } = await (svc as any)
    .from("message_threads")
    .select("id")
    .eq("brand_id", args.brandId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (existingThread) {
    threadId = (existingThread as { id: string }).id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc as any)
      .from("message_threads")
      .update({
        last_message_at: args.createdAt,
        last_message_preview: args.body.slice(0, 200),
        last_message_direction: "inbound",
        last_message_channel: "instagram_dm",
      })
      .eq("id", threadId);
    // increment unread separately to avoid clobbering
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc as any)
      .rpc("increment_thread_unread", { p_thread_id: threadId })
      .then(
        () => {},
        () => {}
      );
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newThread } = await (svc as any)
      .from("message_threads")
      .insert({
        brand_id: args.brandId,
        creator_id: creatorId,
        last_message_at: args.createdAt,
        last_message_preview: args.body.slice(0, 200),
        last_message_direction: "inbound",
        last_message_channel: "instagram_dm",
        unread_count: 1,
        outreach_status: "replied",
      })
      .select("id")
      .single();
    threadId = (newThread as { id: string } | null)?.id ?? "";
  }

  // 4. outreach_messages (inbound). Unique index dedupes on resync.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg } = await (svc as any)
    .from("outreach_messages")
    .upsert(
      {
        brand_id: args.brandId,
        creator_id: creatorId,
        thread_id: threadId,
        channel: "instagram_dm",
        direction: "inbound",
        status: "delivered",
        body: args.body,
        provider_message_id: args.providerMessageId,
        sent_at: args.createdAt,
        delivered_at: args.createdAt,
      },
      { onConflict: "channel,provider_message_id" }
    )
    .select("id")
    .single();

  // 5. Auto-scrape: only on FIRST inbound from a brand-new creator
  let scraped = false;
  if (createdNewCreator && args.senderHandle) {
    const isPublic = await checkIgAccountPublic({
      brandId: args.brandId,
      senderId: args.senderId,
    });
    if (isPublic) {
      scraped = await enqueueCreatorIgScrape({
        brandId: args.brandId,
        handle: args.senderHandle,
        inboundCreatorId: inbound.id,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc as any)
        .from("inbound_creators")
        .update({ status: "rejected" })
        .eq("id", inbound.id);
    }
  }

  return { threadId, messageId: (msg as { id: string } | null)?.id ?? null, scraped };
}

/**
 * Check if an IG sender's account is public via the Graph API. Falls back
 * to optimistic-public if the call fails (the scrape itself will mark
 * the inbound as private if it can't read the profile).
 */
async function checkIgAccountPublic(args: {
  brandId: string;
  senderId: string;
}): Promise<boolean> {
  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: accountRow } = await (svc as any)
    .from("brand_instagram_accounts")
    .select("ig_business_account_id, access_token, account_type")
    .eq("brand_id", args.brandId)
    .maybeSingle();

  const account = accountRow as
    | { ig_business_account_id: string; access_token: string; account_type: string }
    | null;
  if (!account || account.account_type !== "business") return true;

  try {
    const token = decryptToken(account.access_token);
    const profile = await graphGet<{ is_private?: boolean }>(
      `/${args.senderId}`,
      { fields: "is_private", access_token: token }
    );
    return !profile.is_private;
  } catch {
    return true;
  }
}

async function enqueueCreatorIgScrape(args: {
  brandId: string;
  handle: string;
  inboundCreatorId: string;
}): Promise<boolean> {
  const svc = createServiceRoleClient();

  // Skip if a non-terminal job already exists for this brand + handle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc as any)
    .from("background_jobs")
    .select("id, status")
    .eq("brand_id", args.brandId)
    .eq("job_type", "creator_ig_scrape")
    .contains("payload", { handle: args.handle })
    .in("status", ["queued", "running"])
    .maybeSingle();

  if (existing) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any).from("background_jobs").insert({
    brand_id: args.brandId,
    job_type: "creator_ig_scrape",
    status: "queued",
    payload: {
      handle: args.handle,
      source: "instagram_dm_inbound",
      inbound_creator_id: args.inboundCreatorId,
    },
  });

  return !error;
}

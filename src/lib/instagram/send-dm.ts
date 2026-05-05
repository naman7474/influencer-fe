import { createServiceRoleClient } from "@/lib/supabase/server";
import { graphPost } from "@/lib/instagram/graph";
import { decryptToken } from "@/lib/instagram/token-encryption";

export type IgSendResult = {
  ok: true;
  provider_message_id: string;
};

export type IgSendError =
  | { ok: false; reason: "no_account" }
  | { ok: false; reason: "personal_token_kind_unsupported"; kind: string }
  | { ok: false; reason: "graph_error"; message: string };

export async function sendInstagramDm(args: {
  brandId: string;
  recipientId: string; // IG-scoped user id (PSID)
  body: string;
}): Promise<IgSendResult | IgSendError> {
  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: accountRow } = await (svc as any)
    .from("brand_instagram_accounts")
    .select(
      "id, account_type, ig_business_account_id, access_token, personal_token_kind"
    )
    .eq("brand_id", args.brandId)
    .maybeSingle();

  const account = accountRow as
    | {
        id: string;
        account_type: "business" | "personal";
        ig_business_account_id: string | null;
        access_token: string;
        personal_token_kind: "graph_basic" | "session" | "apify_actor" | null;
      }
    | null;
  if (!account) return { ok: false, reason: "no_account" };

  const token = decryptToken(account.access_token);

  if (account.account_type === "business") {
    try {
      const res = await graphPost<{ message_id: string; recipient_id: string }>(
        `/${account.ig_business_account_id}/messages`,
        {
          recipient: { id: args.recipientId },
          message: { text: args.body },
        },
        token
      );
      return { ok: true, provider_message_id: res.message_id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "graph_error";
      return { ok: false, reason: "graph_error", message: msg };
    }
  }

  // Personal mode
  if (account.personal_token_kind === "graph_basic") {
    return {
      ok: false,
      reason: "personal_token_kind_unsupported",
      kind: "graph_basic",
    };
  }

  // session / apify_actor: defer to a worker.
  // Until the worker is wired up, return a clear error so the UI can show it.
  return {
    ok: false,
    reason: "personal_token_kind_unsupported",
    kind: account.personal_token_kind ?? "unknown",
  };
}

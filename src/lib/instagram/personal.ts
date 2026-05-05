import { graphGet, GRAPH_INSTAGRAM_BASE } from "@/lib/instagram/graph";

export type PersonalTokenKind = "graph_basic" | "session" | "apify_actor";

export type PersonalTokenValidation =
  | {
      ok: true;
      ig_user_id: string;
      ig_username: string;
      personal_token_kind: PersonalTokenKind;
    }
  | {
      ok: false;
      reason: "token_invalid" | "username_mismatch" | "unknown_token_format";
    };

/**
 * Validate a pasted personal access token against a claimed username.
 *
 * For now we attempt the IG Graph user-token probe (`graph.instagram.com/me`)
 * which works for tokens minted by Instagram Login (Basic Display successor).
 * Other token kinds (session cookies, Apify actor inputs) cannot be probed
 * server-side cheaply — those are accepted as `personal_token_kind` overrides
 * passed by the client when its UI knows the source.
 */
export async function validatePersonalToken(args: {
  token: string;
  username: string;
  hint?: PersonalTokenKind;
}): Promise<PersonalTokenValidation> {
  const claimedUsername = args.username.trim().toLowerCase().replace(/^@/, "");

  if (!args.hint || args.hint === "graph_basic") {
    try {
      const me = await graphGet<{ id: string; username: string }>(
        "/me",
        { fields: "id,username", access_token: args.token },
        { base: GRAPH_INSTAGRAM_BASE }
      );
      if (me.username?.toLowerCase() !== claimedUsername) {
        return { ok: false, reason: "username_mismatch" };
      }
      return {
        ok: true,
        ig_user_id: me.id,
        ig_username: me.username,
        personal_token_kind: "graph_basic",
      };
    } catch {
      if (args.hint === "graph_basic") {
        return { ok: false, reason: "token_invalid" };
      }
      // fall through to other-kind handling below
    }
  }

  if (args.hint === "session" || args.hint === "apify_actor") {
    // The client UI asserts the token kind. We trust the assertion here
    // and rely on the worker to fail loudly on the first sync attempt
    // if the token is bad. We still record the username as claimed.
    return {
      ok: true,
      ig_user_id: "",
      ig_username: claimedUsername,
      personal_token_kind: args.hint,
    };
  }

  return { ok: false, reason: "unknown_token_format" };
}

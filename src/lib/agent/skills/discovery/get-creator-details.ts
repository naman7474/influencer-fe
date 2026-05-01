import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the full creator intelligence bundle. Mirrors the data model
 * the UI tabs render — caption + transcript + audience intelligence in
 * full, plus all platform-specific creator_scores rows, plus the brand
 * match record for this brand, plus collaboration history.
 *
 * Designed for the second stage of agent search: after the agent has
 * shortlisted 1–3 creators from `creator_search` / `creator_semantic_search`,
 * it calls this tool per creator to get the rich data needed for outreach
 * decisions.
 *
 * NOT designed for raw discovery — calling this on every creator at
 * search time would blow the context window. The tool description below
 * makes that explicit so the LLM doesn't misuse it.
 */
export function getCreatorDetailsTool(
  brandId: string,
  supabase: SupabaseClient,
) {
  return tool({
    description:
      "Get a creator's FULL intelligence bundle: caption, transcript, audience analyses, all platform scores, brand match, collaboration history. Use this after `creator_search` has narrowed candidates — never on raw user queries. Returns rich text and arrays (cultural references, hook examples, brand mentions, audience languages) that let you reason about fit and draft personalised outreach.",
    inputSchema: z.object({
      creator_id: z.string().optional().describe("Creator UUID"),
      handle: z
        .string()
        .optional()
        .describe("Creator handle (without @). Searched against creators.handle and creator_social_profiles.handle."),
    }),
    execute: async (params) => {
      if (!params.creator_id && !params.handle) {
        return { error: "Provide either creator_id or handle" };
      }

      // ── 1. Resolve to canonical creator row ──────────────────
      type CreatorRow = Record<string, unknown> & { id: string };
      const pickFirst = (rows: unknown): CreatorRow | undefined => {
        const arr = Array.isArray(rows) ? rows : [];
        return arr[0] as CreatorRow | undefined;
      };

      let creatorRow: CreatorRow | undefined;
      if (params.creator_id) {
        const { data } = await supabase
          .from("creators")
          .select("*")
          .eq("id", params.creator_id)
          .limit(1);
        creatorRow = pickFirst(data);
      } else {
        const handle = params.handle!.replace(/^@/, "");
        // Try creators.handle first (legacy direct hit).
        const { data: direct } = await supabase
          .from("creators")
          .select("*")
          .eq("handle", handle)
          .limit(1);
        creatorRow = pickFirst(direct);
        if (!creatorRow) {
          // Fall through to creator_social_profiles for YT-suffixed handles
          // or any handle that doesn't coincide with creators.handle.
          const { data: csp } = await supabase
            .from("creator_social_profiles")
            .select("creator_id")
            .eq("handle", handle)
            .limit(1);
          const cspRow = pickFirst(csp) as
            | { creator_id: string }
            | undefined;
          if (cspRow) {
            const { data: byId } = await supabase
              .from("creators")
              .select("*")
              .eq("id", cspRow.creator_id)
              .limit(1);
            creatorRow = pickFirst(byId);
          }
        }
      }
      if (!creatorRow) return { error: "Creator not found" };
      const creatorId = creatorRow.id;

      // ── 2. All the intelligence bundles in parallel ──────────
      const [
        profilesRes,
        scoresRes,
        captionRes,
        transcriptRes,
        audienceRes,
        matchRes,
        campaignsRes,
      ] = await Promise.all([
        supabase
          .from("creator_social_profiles")
          .select("*")
          .eq("creator_id", creatorId)
          .eq("is_active", true),
        supabase
          .from("creator_scores")
          .select("*")
          .eq("creator_id", creatorId)
          .order("computed_at", { ascending: false }),
        supabase
          .from("caption_intelligence")
          .select("*")
          .eq("creator_id", creatorId)
          .order("analyzed_at", { ascending: false }),
        supabase
          .from("transcript_intelligence")
          .select("*")
          .eq("creator_id", creatorId)
          .order("analyzed_at", { ascending: false }),
        supabase
          .from("audience_intelligence")
          .select("*")
          .eq("creator_id", creatorId)
          .order("analyzed_at", { ascending: false }),
        supabase
          .from("creator_brand_matches")
          .select("*")
          .eq("brand_id", brandId)
          .eq("creator_id", creatorId)
          .limit(1),
        supabase
          .from("campaign_creators")
          .select(
            "campaign_id, status, agreed_rate, campaigns!inner(name, goal, status, brand_id)",
          )
          .eq("creator_id", creatorId)
          .eq("campaigns.brand_id", brandId),
      ]);

      const profiles = (profilesRes.data ?? []) as Array<Record<string, unknown>>;
      const allScores = (scoresRes.data ?? []) as Array<Record<string, unknown>>;
      const allCaptions = (captionRes.data ?? []) as Array<Record<string, unknown>>;
      const allTranscripts = (transcriptRes.data ?? []) as Array<Record<string, unknown>>;
      const allAudience = (audienceRes.data ?? []) as Array<Record<string, unknown>>;
      const matchRow = (matchRes.data ?? [])[0] as Record<string, unknown> | undefined;
      const campaigns = (campaignsRes.data ?? []) as Array<Record<string, unknown>>;

      // Pick the latest row per platform for each intelligence table.
      // The lists are already ordered desc by timestamp, so the first
      // row per platform key is the latest.
      const latestByPlatform = <T extends Record<string, unknown>>(
        rows: T[],
      ): Record<string, T> => {
        const map: Record<string, T> = {};
        for (const r of rows) {
          const p =
            ((r.platform as string) ?? "instagram").toLowerCase() || "instagram";
          if (!map[p]) map[p] = r;
        }
        return map;
      };

      const scoresByPlatform = latestByPlatform(allScores);
      const captionByPlatform = latestByPlatform(allCaptions);
      const transcriptByPlatform = latestByPlatform(allTranscripts);
      const audienceByPlatform = latestByPlatform(allAudience);

      // ── 3. Shape the response ────────────────────────────────
      // Strip large `raw_llm_response` payloads — they're internal
      // pipeline state, not useful to the agent and bloat the response
      // by 1–3K tokens per intelligence row.
      const stripRaw = <T extends Record<string, unknown>>(r: T | undefined): T | null => {
        if (!r) return null;
        const out = { ...r } as T;
        delete (out as Record<string, unknown>).raw_llm_response;
        return out;
      };

      // Build per-platform intelligence bundles. Mirrors the UI's
      // intelligence_by_platform map.
      const platforms = Array.from(
        new Set([
          ...Object.keys(scoresByPlatform),
          ...Object.keys(captionByPlatform),
          ...Object.keys(transcriptByPlatform),
          ...Object.keys(audienceByPlatform),
          ...profiles.map((p) => String(p.platform ?? "instagram")),
        ]),
      );

      const intelligence_by_platform: Record<
        string,
        {
          scores: Record<string, unknown> | null;
          caption: Record<string, unknown> | null;
          transcript: Record<string, unknown> | null;
          audience: Record<string, unknown> | null;
        }
      > = {};
      for (const p of platforms) {
        intelligence_by_platform[p] = {
          scores: scoresByPlatform[p] ?? null,
          caption: stripRaw(captionByPlatform[p]),
          transcript: stripRaw(transcriptByPlatform[p]),
          audience: stripRaw(audienceByPlatform[p]),
        };
      }

      return {
        profile: {
          id: creatorRow.id,
          handle: creatorRow.handle,
          display_name: creatorRow.display_name,
          followers: creatorRow.followers,
          tier: creatorRow.tier,
          city: creatorRow.city,
          country: creatorRow.country,
          is_verified: creatorRow.is_verified,
          biography: creatorRow.biography,
          contact_email: creatorRow.contact_email,
          contact_phone: creatorRow.contact_phone,
          external_url: creatorRow.external_url,
          avatar_url: creatorRow.avatar_url,
          first_scraped_at: creatorRow.first_scraped_at,
          last_scraped_at: creatorRow.last_scraped_at,
        },
        social_profiles: profiles.map((p) => ({
          platform: p.platform,
          handle: p.handle,
          profile_url: p.profile_url,
          display_name: p.display_name,
          followers_or_subs: p.followers_or_subs,
          posts_or_videos_count: p.posts_or_videos_count,
          avatar_url: p.avatar_url,
          bio: p.bio,
          is_verified: p.is_verified,
          country: p.country,
          category: p.category,
          external_links: p.external_links,
          last_synced_at: p.last_synced_at,
        })),
        intelligence_by_platform,
        brand_match: matchRow
          ? {
              match_score: matchRow.match_score,
              niche_fit: matchRow.niche_fit_score,
              audience_geo: matchRow.audience_geo_score,
              reasoning: matchRow.match_reasoning,
              mentions_brand: matchRow.already_mentions_brand,
              mentions_competitor: matchRow.mentions_competitor,
            }
          : null,
        collaboration_history: campaigns.map((c) => ({
          campaign_id: c.campaign_id,
          status: c.status,
          agreed_rate: c.agreed_rate,
        })),
      };
    },
  });
}

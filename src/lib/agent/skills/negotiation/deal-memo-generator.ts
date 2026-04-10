import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function dealMemoGeneratorTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to generate and store a deal memo in the database. This is the only way to create a real deal memo. Call it when the user says create deal memo, summarize the deal, or finalize terms.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
      creator_id: z.string().describe("Creator UUID"),
      agreed_rate: z.number().describe("Final agreed rate in INR"),
      content_deliverables: z
        .array(
          z.object({
            type: z.string().describe("Content type: reel, static, carousel, story"),
            quantity: z.number().describe("Number of pieces"),
          })
        )
        .optional()
        .describe("Content deliverables breakdown"),
      usage_rights: z
        .string()
        .optional()
        .describe("Usage rights terms (e.g. '30 days organic + paid')"),
      exclusivity_period: z
        .string()
        .optional()
        .describe("Exclusivity period (e.g. '60 days no competing brands')"),
      payment_terms: z
        .string()
        .optional()
        .describe("Payment terms (e.g. '50% upfront, 50% on delivery')"),
      special_notes: z
        .string()
        .optional()
        .describe("Any special terms or notes"),
    }),
    execute: async (params) => {
      // 1. Load campaign + creator + cc
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select("id, name, start_date, end_date")
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign) return { error: "Campaign not found or access denied" };

      const { data: creatorRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select("creator_id, handle, display_name, followers, tier")
        .eq("creator_id", params.creator_id)
        .single();
      const creator = creatorRaw as Record<string, unknown> | null;

      if (!creator) return { error: "Creator not found" };

      const { data: ccRaw } = await supabase
        .from("campaign_creators")
        .select("id")
        .eq("campaign_id", params.campaign_id)
        .eq("creator_id", params.creator_id)
        .single();
      const cc = ccRaw as Record<string, unknown> | null;

      if (!cc) return { error: "Creator is not part of this campaign" };

      // 2. Get negotiation history
      const { data: roundsRaw } = await supabase
        .from("negotiations")
        .select("round_number, brand_offer, creator_ask, action_taken")
        .eq("campaign_id", params.campaign_id)
        .eq("creator_id", params.creator_id)
        .order("round_number", { ascending: true });
      const rounds = (roundsRaw || []) as Record<string, unknown>[];

      // 3. Build and store deal memo
      const memoData = {
        campaign_creator_id: cc.id,
        campaign_id: params.campaign_id,
        brand_id: brandId,
        creator_id: params.creator_id,
        agreed_rate: params.agreed_rate,
        content_deliverables: params.content_deliverables || [],
        usage_rights: params.usage_rights || "Standard organic use",
        exclusivity_period: params.exclusivity_period || "None",
        payment_terms: params.payment_terms || "Full payment on content approval",
        special_notes: params.special_notes || null,
        negotiation_rounds: rounds.length,
        generated_by: "agent",
      };

      const { data: memoRaw, error } = await supabase
        .from("deal_memos")
        .upsert(memoData as never, {
          onConflict: "campaign_creator_id",
        })
        .select("id")
        .single();

      if (error) {
        return { error: `Failed to save deal memo: ${error.message}` };
      }

      // 4. Update campaign_creator with agreed rate and status
      await supabase
        .from("campaign_creators")
        .update({
          agreed_rate: params.agreed_rate,
          negotiation_status: "agreed",
          status: "confirmed",
        } as never)
        .eq("id", cc.id);

      // 5. Update any active negotiations to accepted
      if (rounds.length > 0) {
        await supabase
          .from("negotiations")
          .update({ status: "accepted" } as never)
          .eq("campaign_id", params.campaign_id)
          .eq("creator_id", params.creator_id)
          .eq("status", "active");
      }

      return {
        memo_id: (memoRaw as Record<string, unknown>)?.id,
        deal_memo: {
          campaign: campaign.name,
          creator: {
            handle: creator.handle,
            display_name: creator.display_name,
            tier: creator.tier,
            followers: creator.followers,
          },
          terms: {
            agreed_rate: params.agreed_rate,
            content_deliverables: params.content_deliverables || [],
            usage_rights: params.usage_rights || "Standard organic use",
            exclusivity_period: params.exclusivity_period || "None",
            payment_terms:
              params.payment_terms || "Full payment on content approval",
            special_notes: params.special_notes || null,
          },
          campaign_dates: {
            start: campaign.start_date,
            end: campaign.end_date,
          },
          negotiation_summary: {
            total_rounds: rounds.length,
            rounds: rounds.map((r) => ({
              round: r.round_number,
              brand_offer: r.brand_offer,
              creator_ask: r.creator_ask,
              action: r.action_taken,
            })),
          },
        },
      };
    },
  });
}

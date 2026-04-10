import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApprovalRequest } from "../_shared/approval-wrapper";

export function discountCodeGeneratorTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to generate discount codes for campaign creators. This tool creates real Shopify discount codes and stores tracking data in the database. Submits for approval. Call it whenever the user asks to create discount codes, generate codes, or set up tracking codes.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
      discount_percent: z
        .number()
        .optional()
        .default(15)
        .describe("Discount percentage (1-50)"),
      creator_ids: z
        .array(z.string())
        .optional()
        .describe(
          "Specific creator UUIDs. If omitted, generates for all confirmed creators."
        ),
    }),
    execute: async (params) => {
      // 1. Load campaign
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select("id, name, brand_id, status")
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign) return { error: "Campaign not found or access denied" };

      // 2. Get target creators
      let creatorQuery = supabase
        .from("campaign_creators")
        .select(
          "id, creator_id, status, creators:creator_id(handle, display_name)"
        )
        .eq("campaign_id", params.campaign_id);

      if (params.creator_ids && params.creator_ids.length > 0) {
        creatorQuery = creatorQuery.in("creator_id", params.creator_ids);
      } else {
        creatorQuery = creatorQuery.eq("status", "confirmed");
      }

      const { data: creatorsRaw } = await creatorQuery;
      const creators = (creatorsRaw || []) as Record<string, unknown>[];

      if (creators.length === 0) {
        return {
          error:
            "No eligible creators found. Ensure creators are confirmed in this campaign.",
        };
      }

      // 3. Check for existing codes
      const creatorIds = creators.map((c) => c.creator_id as string);
      const { data: existingRaw } = await supabase
        .from("campaign_discount_codes")
        .select("creator_id, code")
        .eq("campaign_id", params.campaign_id)
        .in("creator_id", creatorIds);
      const existing = (existingRaw || []) as Record<string, unknown>[];
      const existingCreatorIds = new Set(
        existing.map((e) => e.creator_id as string)
      );

      const newCreators = creators.filter(
        (c) => !existingCreatorIds.has(c.creator_id as string)
      );

      if (newCreators.length === 0) {
        return {
          message: "All specified creators already have discount codes.",
          existing_codes: existing.map((e) => ({
            creator_id: e.creator_id,
            code: e.code,
          })),
        };
      }

      // 4. Submit for approval (medium-risk — creates real Shopify discounts)
      const codePreview = newCreators.map((c) => {
        const creator = c.creators as Record<string, unknown> | null;
        const handle = (creator?.handle as string) || "unknown";
        const codeName = handle
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(0, 12);
        return {
          creator_id: c.creator_id,
          handle,
          preview_code: `${codeName}${params.discount_percent ?? 15}`,
        };
      });

      const result = await createApprovalRequest(supabase, {
        brandId,
        actionType: "generate_discount_code",
        title: `Generate ${newCreators.length} discount codes for "${campaign.name}"`,
        description: `Create ${params.discount_percent ?? 15}% discount codes for ${newCreators.length} creators in campaign "${campaign.name}".`,
        reasoning: `User requested discount code generation. ${existing.length} creator(s) already have codes.`,
        payload: {
          campaign_id: params.campaign_id,
          campaign_name: campaign.name,
          discount_percent: params.discount_percent ?? 15,
          creators: codePreview,
        },
        campaignId: params.campaign_id,
      });

      return {
        ...result,
        codes_to_generate: newCreators.length,
        already_have_codes: existing.length,
        preview: codePreview,
      };
    },
  });
}

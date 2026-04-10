import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApprovalRequest } from "../_shared/approval-wrapper";

export function giftingOrderCreatorTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to create a gifting order — sends free product via Shopify draft order. This tool writes to the database and submits for approval. Call it whenever the user asks to send product, gift product, send a sample, or create a gifting order.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
      creator_id: z.string().describe("Creator UUID"),
      product_title: z
        .string()
        .describe("Product name/title to gift"),
      variant_id: z
        .string()
        .optional()
        .describe("Shopify variant ID (if known)"),
      retail_value: z
        .number()
        .optional()
        .describe("Retail value in INR"),
      note: z
        .string()
        .optional()
        .describe("Personal note to include with gift"),
    }),
    execute: async (params) => {
      // 1. Verify campaign + creator relationship
      const { data: ccRaw } = await supabase
        .from("campaign_creators")
        .select("id, status, creator_id")
        .eq("campaign_id", params.campaign_id)
        .eq("creator_id", params.creator_id)
        .eq("brand_id", brandId)
        .single();
      const cc = ccRaw as Record<string, unknown> | null;

      if (!cc) {
        // Try without brand_id on campaign_creators (brand_id might not be on this table)
        const { data: campaignRaw } = await supabase
          .from("campaigns")
          .select("id, name")
          .eq("id", params.campaign_id)
          .eq("brand_id", brandId)
          .single();

        if (!campaignRaw) {
          return { error: "Campaign not found or access denied" };
        }

        const { data: ccRetry } = await supabase
          .from("campaign_creators")
          .select("id, status")
          .eq("campaign_id", params.campaign_id)
          .eq("creator_id", params.creator_id)
          .single();

        if (!ccRetry) {
          return {
            error:
              "Creator is not part of this campaign. Add them first.",
          };
        }
      }

      // 2. Check for existing gifting order
      const { data: existingRaw } = await supabase
        .from("gifting_orders")
        .select("id, status, product_title")
        .eq("campaign_id", params.campaign_id)
        .eq("creator_id", params.creator_id);
      const existing = (existingRaw || []) as Record<string, unknown>[];

      if (existing.length > 0) {
        return {
          warning: `Creator already has ${existing.length} gifting order(s) for this campaign.`,
          existing_orders: existing.map((o) => ({
            id: o.id,
            status: o.status,
            product: o.product_title,
          })),
          message:
            "If you want to send another product, confirm and I'll create the order.",
        };
      }

      // 3. Load creator for context
      const { data: creatorRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select("creator_id, handle, display_name, city")
        .eq("creator_id", params.creator_id)
        .single();
      const creator = creatorRaw as Record<string, unknown> | null;

      // 4. Submit for approval (high-risk — involves shipping real product)
      const result = await createApprovalRequest(supabase, {
        brandId,
        actionType: "gifting_order",
        title: `Gift "${params.product_title}" to ${creator?.handle ?? params.creator_id}`,
        description: `Send ${params.product_title}${params.retail_value ? ` (₹${params.retail_value.toLocaleString("en-IN")})` : ""} to ${creator?.display_name ?? "creator"}${creator?.city ? ` in ${creator.city}` : ""}.${params.note ? ` Note: "${params.note}"` : ""}`,
        reasoning:
          "Product gifting requested by user. Requires shipping address collection and Shopify draft order creation.",
        payload: {
          campaign_id: params.campaign_id,
          creator_id: params.creator_id,
          creator_handle: creator?.handle,
          product_title: params.product_title,
          variant_id: params.variant_id ?? null,
          retail_value: params.retail_value ?? null,
          note: params.note ?? null,
        },
        campaignId: params.campaign_id,
        creatorId: params.creator_id,
      });

      return {
        ...result,
        gifting_preview: {
          product: params.product_title,
          creator: creator?.handle ?? params.creator_id,
          retail_value: params.retail_value,
          next_steps: [
            "Approval needed from brand manager",
            "Creator's shipping address will be collected",
            "Shopify draft order will be created",
          ],
        },
      };
    },
  });
}

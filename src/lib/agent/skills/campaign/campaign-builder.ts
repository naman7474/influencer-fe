import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApprovalRequest } from "../_shared/approval-wrapper";

export function campaignBuilderTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "Create a new campaign from a natural-language brief. Because creating a campaign is a high-risk action, this will submit a proposal for brand-manager approval rather than creating it directly. Use when the user says 'create a campaign', 'launch a new campaign', or 'set up a campaign'.",
    inputSchema: z.object({
      name: z.string().describe("Campaign name"),
      goal: z
        .string()
        .describe("Campaign goal / brief in natural language"),
      budget: z
        .number()
        .optional()
        .describe("Total budget in INR"),
      start_date: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD)"),
      end_date: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD)"),
      discount_percent: z
        .number()
        .optional()
        .default(15)
        .describe("Default discount percentage for creator codes"),
      creator_ids: z
        .array(z.string())
        .optional()
        .describe("Pre-selected creator UUIDs to add to campaign"),
      brief_requirements: z
        .array(z.string())
        .optional()
        .describe("Content requirements for creators (e.g. 'Must include product close-up')"),
    }),
    execute: async (params) => {
      // Validate dates
      if (params.start_date && params.end_date) {
        if (new Date(params.end_date) <= new Date(params.start_date)) {
          return { error: "end_date must be after start_date" };
        }
      }

      // Build campaign payload
      const payload = {
        brand_id: brandId,
        name: params.name,
        goal: params.goal,
        budget: params.budget ?? null,
        start_date: params.start_date ?? null,
        end_date: params.end_date ?? null,
        discount_percent: params.discount_percent ?? 15,
        creator_ids: params.creator_ids ?? [],
        brief_requirements: params.brief_requirements ?? [],
        status: "draft",
      };

      // Validate creator IDs exist if provided
      if (payload.creator_ids.length > 0) {
        const { data: creatorsRaw } = await supabase
          .from("mv_creator_leaderboard")
          .select("creator_id, handle")
          .in("creator_id", payload.creator_ids);
        const found = (creatorsRaw || []) as { creator_id: string; handle: string }[];
        if (found.length !== payload.creator_ids.length) {
          const foundIds = new Set(found.map((c) => c.creator_id));
          const missing = payload.creator_ids.filter((id) => !foundIds.has(id));
          return {
            error: `${missing.length} creator(s) not found: ${missing.join(", ")}`,
          };
        }
      }

      // Submit for approval (high-risk action)
      const result = await createApprovalRequest(supabase, {
        brandId,
        actionType: "create_campaign",
        title: `Create campaign: ${params.name}`,
        description: `New campaign "${params.name}" with goal: ${params.goal}. Budget: ${params.budget ? `₹${params.budget.toLocaleString("en-IN")}` : "not set"}. ${payload.creator_ids.length} creators pre-selected.`,
        reasoning: `User requested campaign creation with the following brief: ${params.goal}`,
        payload,
        campaignId: undefined,
        creatorId: undefined,
        messageId: undefined,
      });

      return {
        ...result,
        campaign_preview: {
          name: params.name,
          goal: params.goal,
          budget: params.budget,
          dates:
            params.start_date && params.end_date
              ? `${params.start_date} → ${params.end_date}`
              : "Not set",
          creators_count: payload.creator_ids.length,
          brief_requirements: payload.brief_requirements,
        },
      };
    },
  });
}

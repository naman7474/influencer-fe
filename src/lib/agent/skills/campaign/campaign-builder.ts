import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApprovalRequest } from "../_shared/approval-wrapper";

export function campaignBuilderTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "CALL THIS TOOL to create a new campaign. This is the ONLY way to create campaigns — you cannot create one by describing it in text. This tool writes to the database and submits the campaign for brand-manager approval. Call it whenever the user asks to create, launch, or set up a campaign.",
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

      // Map free-text goal to campaign_goal enum
      const goalText = (params.goal || "").toLowerCase();
      const goalEnum = goalText.includes("ugc") || goalText.includes("content generation")
        ? "ugc_generation"
        : goalText.includes("conversion") || goalText.includes("sale") || goalText.includes("revenue")
          ? "conversion"
          : "awareness";

      // Create the campaign row immediately as "draft" so downstream tools
      // (outreach_drafter, brief_generator, etc.) get a real campaign_id.
      // Approval controls activation (draft → active), not creation.
      const { data: newCampaignRaw, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          brand_id: brandId,
          name: params.name,
          goal: goalEnum,
          description: params.goal || null,
          total_budget: params.budget ?? null,
          start_date: params.start_date ?? null,
          end_date: params.end_date ?? null,
          default_discount_percentage: params.discount_percent ?? null,
          brief_requirements: params.brief_requirements ?? [],
          status: "draft",
        } as never)
        .select("id")
        .single();
      const newCampaign = newCampaignRaw as { id: string } | null;

      if (campaignError || !newCampaign) {
        console.error("[campaign_builder] Campaign insert failed:", campaignError);
        return { error: `Failed to create campaign: ${campaignError?.message ?? "unknown error"}` };
      }

      const campaignId = newCampaign.id;

      // Add pre-selected creators to campaign_creators
      if (payload.creator_ids.length > 0) {
        const ccInserts = payload.creator_ids.map((cid) => ({
          campaign_id: campaignId,
          creator_id: cid,
          brand_id: brandId,
          status: "shortlisted",
        }));
        await supabase.from("campaign_creators").insert(ccInserts as never);
      }

      // Submit for approval to activate the campaign (draft → active)
      console.log("[campaign_builder] Submitting for approval, brandId:", brandId);
      const result = await createApprovalRequest(supabase, {
        brandId,
        actionType: "create_campaign",
        title: `Activate campaign: ${params.name}`,
        description: `Campaign "${params.name}" with goal: ${params.goal}. Budget: ${params.budget ? `₹${params.budget.toLocaleString("en-IN")}` : "not set"}. ${payload.creator_ids.length} creators pre-selected.`,
        reasoning: `User requested campaign creation with the following brief: ${params.goal}`,
        payload: { ...payload, campaign_id: campaignId },
        campaignId,
        creatorId: undefined,
        messageId: undefined,
      });

      // If approval creation failed, campaign still exists as draft
      if ("error" in result) {
        console.error("[campaign_builder] Approval creation failed:", result.error);
        return {
          ...result,
          campaign_id: campaignId,
        };
      }
      console.log("[campaign_builder] Approval created successfully");

      return {
        ...result,
        campaign_id: campaignId,
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

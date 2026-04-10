import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function contentMonitorTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "Monitor content submission status across campaigns. Shows which creators have submitted, pending review, approved, or need revision. Use when the user asks about 'content status', 'who submitted content', 'content review', or 'submission status'.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
      status_filter: z
        .enum(["all", "submitted", "approved", "rejected", "revision_requested", "pending"])
        .optional()
        .default("all")
        .describe("Filter by submission status"),
    }),
    execute: async (params) => {
      // 1. Verify campaign access
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select("id, name, status")
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign) return { error: "Campaign not found or access denied" };

      // 2. Get all campaign creators with content status
      const { data: creatorsRaw } = await supabase
        .from("campaign_creators")
        .select(
          "id, creator_id, status, content_status, creators:creator_id(handle, display_name)"
        )
        .eq("campaign_id", params.campaign_id);
      const creators = (creatorsRaw || []) as Record<string, unknown>[];

      // 3. Get content submissions
      let submissionQuery = supabase
        .from("content_submissions")
        .select(
          "id, campaign_creator_id, creator_id, caption_text, content_url, status, compliance_check, submitted_at, reviewed_at, feedback, compliance_scan_status"
        )
        .eq("campaign_id", params.campaign_id)
        .order("submitted_at", { ascending: false });

      if (params.status_filter && params.status_filter !== "all") {
        submissionQuery = submissionQuery.eq("status", params.status_filter);
      }

      const { data: submissionsRaw } = await submissionQuery;
      const submissions = (submissionsRaw || []) as Record<string, unknown>[];

      // 4. Build creator-centric view
      const submissionsByCreator = new Map<string, Record<string, unknown>[]>();
      for (const sub of submissions) {
        const cid = sub.creator_id as string;
        if (!submissionsByCreator.has(cid)) {
          submissionsByCreator.set(cid, []);
        }
        submissionsByCreator.get(cid)!.push(sub);
      }

      const creatorStatuses = creators.map((c) => {
        const creator = c.creators as Record<string, unknown> | null;
        const creatorId = c.creator_id as string;
        const subs = submissionsByCreator.get(creatorId) || [];

        return {
          creator_id: creatorId,
          handle: creator?.handle ?? creatorId,
          display_name: creator?.display_name,
          campaign_status: c.status,
          content_status: c.content_status ?? "not_submitted",
          submissions: subs.map((s) => ({
            id: s.id,
            status: s.status,
            content_url: s.content_url,
            caption_preview: s.caption_text
              ? (s.caption_text as string).slice(0, 100) +
                ((s.caption_text as string).length > 100 ? "..." : "")
              : null,
            compliance_check: s.compliance_check,
            compliance_scan_status: s.compliance_scan_status,
            submitted_at: s.submitted_at,
            reviewed_at: s.reviewed_at,
            feedback: s.feedback,
          })),
          submission_count: subs.length,
        };
      });

      // 5. Summary stats
      const statusCounts = {
        total_creators: creators.length,
        not_submitted: creatorStatuses.filter(
          (c) => c.content_status === "not_submitted"
        ).length,
        submitted: creatorStatuses.filter(
          (c) => c.content_status === "submitted"
        ).length,
        approved: creatorStatuses.filter(
          (c) => c.content_status === "approved"
        ).length,
        rejected: creatorStatuses.filter(
          (c) => c.content_status === "rejected"
        ).length,
        revision_requested: creatorStatuses.filter(
          (c) => c.content_status === "revision_requested"
        ).length,
      };

      // Filter if needed for pending (not_submitted)
      let filteredStatuses = creatorStatuses;
      if (params.status_filter === "pending") {
        filteredStatuses = creatorStatuses.filter(
          (c) => c.content_status === "not_submitted"
        );
      }

      return {
        campaign: campaign.name,
        summary: statusCounts,
        creators: filteredStatuses,
        total_submissions: submissions.length,
      };
    },
  });
}

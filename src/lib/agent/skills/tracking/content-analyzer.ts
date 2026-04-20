import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function contentAnalyzerTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to get AI video analysis of a content submission. Returns quality scores (hook strength, brand mention naturalness, brief compliance, guideline compliance, language/tone, content depth, cultural signals, CTA effectiveness, production quality), transcript, and actionable recommendations. Also supports comparing multiple submissions or summarizing all analyses for a campaign. Call it when the user asks about content quality, video analysis, submission scores, or wants to compare submissions.",
    inputSchema: z.object({
      submission_id: z
        .string()
        .optional()
        .describe("Single content submission UUID to analyze"),
      campaign_id: z
        .string()
        .optional()
        .describe(
          "Campaign UUID to get all analyses (for comparison or summary)"
        ),
      action: z
        .enum(["analyze", "compare", "summarize"])
        .default("analyze")
        .describe(
          "analyze: single submission detail; compare: side-by-side of all campaign submissions; summarize: aggregate stats"
        ),
    }),
    execute: async (params) => {
      // ── Single submission analysis ──
      if (params.action === "analyze" && params.submission_id) {
        const { data: analysisRaw } = await supabase
          .from("content_analyses")
          .select("*")
          .eq("content_submission_id", params.submission_id)
          .single();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const analysis = analysisRaw as Record<string, any> | null;

        if (!analysis) {
          return {
            status: "no_analysis",
            message:
              "No analysis found for this submission. It may still be processing, or the video hasn't been analyzed yet.",
          };
        }

        // Verify brand access
        if (analysis.brand_id !== brandId) {
          return { error: "Access denied" };
        }

        if (analysis.status !== "completed") {
          return {
            status: analysis.status,
            message: `Analysis is currently ${analysis.status}.`,
            error_message: analysis.error_message,
          };
        }

        return {
          status: "completed",
          overall_score: analysis.overall_score,
          analysis: analysis.analysis,
          transcript: analysis.transcript_text,
          detected_language: analysis.detected_language,
          hook_text: analysis.hook_text,
          is_likely_music: analysis.is_likely_music,
        };
      }

      // ── Campaign-wide comparison or summary ──
      const campaignId = params.campaign_id;
      if (!campaignId) {
        return {
          error: "Please provide either a submission_id or campaign_id.",
        };
      }

      // Verify brand owns campaign
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("id", campaignId)
        .eq("brand_id", brandId)
        .single();

      if (!campaign) {
        return { error: "Campaign not found or access denied" };
      }

      // Get all analyses for the campaign
      const { data: analyses } = await supabase
        .from("content_analyses")
        .select(
          "content_submission_id, creator_id, status, overall_score, hook_strength_score, brand_mention_score, brief_compliance_score, guideline_compliance_score, analysis"
        )
        .eq("campaign_id", campaignId)
        .eq("status", "completed")
        .order("overall_score", { ascending: false });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completed = (analyses ?? []) as Record<string, any>[];

      if (completed.length === 0) {
        return {
          status: "no_analyses",
          message: "No completed analyses found for this campaign.",
        };
      }

      // Get creator handles
      const creatorIds = [
        ...new Set(completed.map((a) => a.creator_id as string)),
      ];
      const { data: creators } = await supabase
        .from("creators")
        .select("id, handle")
        .in("id", creatorIds);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleMap = new Map(
        ((creators ?? []) as { id: string; handle: string }[]).map((c) => [
          c.id,
          c.handle,
        ])
      );

      if (params.action === "compare") {
        return {
          campaign_name: (campaign as { name: string }).name,
          submissions: completed.map((a) => ({
            submission_id: a.content_submission_id,
            creator: handleMap.get(a.creator_id) ?? "unknown",
            overall_score: a.overall_score,
            hook_strength: a.hook_strength_score,
            brand_mention: a.brand_mention_score,
            brief_compliance: a.brief_compliance_score,
            guideline_compliance: a.guideline_compliance_score,
            recommendation: a.analysis?.overall?.recommendation,
            summary: a.analysis?.overall?.summary,
          })),
        };
      }

      // Summarize
      const scores = completed
        .map((a) => a.overall_score as number)
        .filter(Boolean);
      const avg = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      const recommendations = completed.reduce(
        (acc, a) => {
          const rec = a.analysis?.overall?.recommendation ?? "unknown";
          acc[rec] = (acc[rec] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        campaign_name: (campaign as { name: string }).name,
        total_submissions: completed.length,
        average_score: avg,
        highest_score: Math.max(...scores),
        lowest_score: Math.min(...scores),
        recommendation_breakdown: recommendations,
        top_submission: {
          creator: handleMap.get(completed[0].creator_id) ?? "unknown",
          score: completed[0].overall_score,
          summary: completed[0].analysis?.overall?.summary,
        },
      };
    },
  });
}

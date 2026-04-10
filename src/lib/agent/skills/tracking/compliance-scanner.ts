import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const AD_DISCLOSURE_PATTERNS = [
  /#ad\b/i,
  /#sponsored\b/i,
  /#partner\b/i,
  /#paidpartnership/i,
  /#collab\b/i,
  /\bpaid\s+partnership\b/i,
  /\bsponsored\s+post\b/i,
  /\bad\b.*\bpartner/i,
];

export function complianceScannerTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to scan content for compliance. Checks ad disclosure, brand mentions, and brief requirements against real submission data. Call it when the user asks to check compliance, review content, or scan a submission.",
    inputSchema: z.object({
      submission_id: z.string().describe("Content submission UUID"),
    }),
    execute: async (params) => {
      // 1. Load submission
      const { data: subRaw } = await supabase
        .from("content_submissions")
        .select(
          "id, campaign_id, creator_id, campaign_creator_id, caption_text, content_url, status"
        )
        .eq("id", params.submission_id)
        .single();
      const submission = subRaw as Record<string, unknown> | null;

      if (!submission) return { error: "Submission not found" };

      // 2. Load campaign with brief requirements
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select(
          "id, name, brand_id, default_discount_percentage, brief_requirements"
        )
        .eq("id", submission.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign) return { error: "Campaign not found or access denied" };

      // 3. Load brand info
      const { data: brandRaw } = await supabase
        .from("brands")
        .select("brand_name, instagram_handle")
        .eq("id", brandId)
        .single();
      const brand = brandRaw as Record<string, unknown> | null;

      // 4. Get discount code for this creator
      const { data: codeRaw } = await supabase
        .from("campaign_discount_codes")
        .select("code")
        .eq("campaign_id", submission.campaign_id as string)
        .eq("creator_id", submission.creator_id as string)
        .single();
      const discountCode = (codeRaw as Record<string, unknown> | null)
        ?.code as string | null;

      const caption = (submission.caption_text as string) || "";
      const issues: string[] = [];

      // 5. Check ad disclosure
      const hasAdDisclosure = AD_DISCLOSURE_PATTERNS.some((p) =>
        p.test(caption)
      );
      if (!hasAdDisclosure) {
        issues.push(
          "Missing ad disclosure (#ad, #sponsored, or #partner required)"
        );
      }

      // 6. Check brand mention
      const brandName = (brand?.brand_name as string) || "";
      const brandHandle = (brand?.instagram_handle as string) || "";
      const hasBrandMention =
        caption.toLowerCase().includes(brandName.toLowerCase()) ||
        (brandHandle &&
          caption.toLowerCase().includes(brandHandle.toLowerCase())) ||
        caption
          .toLowerCase()
          .includes(`@${brandName.replace(/\s+/g, "").toLowerCase()}`);
      if (!hasBrandMention) {
        issues.push(
          `Missing brand mention (@${brandName.replace(/\s+/g, "").toLowerCase()} or "${brandName}")`
        );
      }

      // 7. Check discount code
      let hasDiscountCode = false;
      if (discountCode) {
        hasDiscountCode = caption
          .toUpperCase()
          .includes(discountCode.toUpperCase());
        if (!hasDiscountCode) {
          issues.push(
            `Missing discount code "${discountCode}" in caption`
          );
        }
      }

      // 8. Check brief requirements
      const briefRequirements =
        (campaign.brief_requirements as string[]) || [];
      const requirementResults = briefRequirements.map((req) => {
        // Simple keyword check — in production this would use LLM
        const keywords = req
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        const met = keywords.some((kw) =>
          caption.toLowerCase().includes(kw)
        );
        if (!met) {
          issues.push(`Brief requirement possibly not met: "${req}"`);
        }
        return { requirement: req, met };
      });

      // 9. Overall pass/fail
      const overallPass = hasAdDisclosure && hasBrandMention && issues.length === 0;

      // 10. Generate revision draft if failed
      let revisionDraft: string | null = null;
      if (!overallPass) {
        revisionDraft = `Hi! Thanks for the content submission. Before we can approve, please address the following:\n\n${issues.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}\n\nPlease update and resubmit. Thanks!`;
      }

      // 11. Store compliance scan
      const scanData = {
        content_submission_id: params.submission_id,
        campaign_id: submission.campaign_id,
        brand_id: brandId,
        has_ad_disclosure: hasAdDisclosure,
        has_brand_mention: hasBrandMention,
        has_product_visibility: null, // requires image analysis
        has_discount_code: hasDiscountCode,
        has_spoken_brand_mention: null, // requires audio analysis
        transcription_text: null,
        brief_requirements_met: requirementResults,
        overall_pass: overallPass,
        issues_found: issues,
        revision_draft: revisionDraft,
        scan_model: "rule-based-v1",
      };

      await supabase.from("compliance_scans").insert(scanData as never);

      // 12. Update submission compliance status
      await supabase
        .from("content_submissions")
        .update({
          compliance_scan_status: overallPass ? "passed" : "failed",
        } as never)
        .eq("id", params.submission_id);

      return {
        submission_id: params.submission_id,
        overall_pass: overallPass,
        checks: {
          ad_disclosure: hasAdDisclosure,
          brand_mention: hasBrandMention,
          discount_code: discountCode ? hasDiscountCode : "n/a",
          brief_requirements: requirementResults,
        },
        issues,
        revision_draft: revisionDraft,
      };
    },
  });
}

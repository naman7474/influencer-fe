import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function utmGeneratorTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "CALL THIS TOOL to generate and store UTM tracking links in the database. This is the only way to create real tracking links. Call it when the user asks to create UTM links, generate tracking links, or set up attribution.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
      creator_ids: z
        .array(z.string())
        .optional()
        .describe(
          "Specific creator UUIDs. If omitted, generates for all confirmed creators."
        ),
    }),
    execute: async (params) => {
      // 1. Load campaign + brand
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select("id, name, brand_id, status")
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign)
        return { error: "Campaign not found or access denied" };

      const { data: brandRaw } = await supabase
        .from("brands")
        .select("brand_name, website")
        .eq("id", brandId)
        .single();
      const brand = brandRaw as Record<string, unknown> | null;

      if (!brand?.website) {
        return {
          error:
            "Brand website not set. Update your brand profile with a website URL first.",
        };
      }

      // 2. Get target creators
      let creatorQuery = supabase
        .from("campaign_creators")
        .select(
          "id, creator_id, status, creators:creator_id(handle, display_name, tier)"
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

      // 3. Generate UTM links
      const website = (brand.website as string).replace(/\/+$/, "");
      const campaignSlug = (campaign.name as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const links: Record<string, unknown>[] = [];

      for (const cc of creators) {
        const creator = cc.creators as Record<string, unknown> | null;
        const handle = ((creator?.handle as string) || "unknown").replace(
          /^@/,
          ""
        );
        const tier = (creator?.tier as string) || "unknown";

        const utmParams = new URLSearchParams({
          utm_source: "instagram",
          utm_medium: "influencer",
          utm_campaign: campaignSlug,
          utm_content: handle,
          utm_term: tier,
        });

        const fullUrl = `${website}?${utmParams.toString()}`;
        const shortCode = generateShortCode();

        // Upsert into campaign_utm_links
        const { data: linkRaw } = await supabase
          .from("campaign_utm_links")
          .upsert(
            {
              campaign_id: params.campaign_id,
              creator_id: cc.creator_id,
              brand_id: brandId,
              utm_source: "instagram",
              utm_medium: "influencer",
              utm_campaign: campaignSlug,
              utm_content: handle,
              utm_term: tier,
              full_url: fullUrl,
              short_code: shortCode,
              short_url: `/api/link/${shortCode}`,
            },
            { onConflict: "campaign_id,creator_id" }
          )
          .select()
          .single();

        links.push({
          creator_id: cc.creator_id,
          handle: creator?.handle,
          full_url: fullUrl,
          short_code: shortCode,
          short_url: `/api/link/${shortCode}`,
        });
      }

      return {
        campaign: campaign.name,
        links,
        count: links.length,
      };
    },
  });
}

function generateShortCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveTemplate,
  generatePersonalizationHook,
  type MergeContext,
} from "@/lib/outreach/merge-fields";

export function outreachDrafterTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to draft a personalized outreach email. This tool saves the draft to the database — you cannot draft outreach by writing it in chat. The draft requires approval before sending. Call it whenever the user asks to draft, write, or compose outreach to a creator.",
    inputSchema: z.object({
      creator_id: z.string().describe("Creator UUID to draft outreach for"),
      campaign_id: z
        .string()
        .optional()
        .describe("Campaign UUID to associate with"),
      template_id: z
        .string()
        .optional()
        .describe("Template UUID to use as base"),
      custom_instructions: z
        .string()
        .optional()
        .describe(
          "Custom instructions for the draft (e.g. mention a specific product, adjust tone)"
        ),
    }),
    execute: async (params) => {
      // 1. Load creator from leaderboard
      const { data: creatorLbRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select("*")
        .eq("creator_id", params.creator_id)
        .single();
      const creatorLb = creatorLbRaw as Record<string, unknown> | null;

      if (!creatorLb) return { error: "Creator not found" };

      // Get full creator record for contact email
      const { data: creatorFullRaw } = await supabase
        .from("creators")
        .select("contact_email, display_name, biography")
        .eq("id", params.creator_id)
        .single(); // creators table has 'id' as PK — this is correct
      const creatorFull = creatorFullRaw as Record<string, unknown> | null;

      if (!creatorFull?.contact_email) {
        return {
          error: `Creator @${creatorLb.handle} does not have a contact email on file. Cannot draft outreach.`,
        };
      }

      // 2. Load brand
      const { data: brandRaw } = await supabase
        .from("brands")
        .select("*")
        .eq("id", brandId)
        .single();
      const brand = brandRaw as Record<string, unknown> | null;

      if (!brand) return { error: "Brand not found" };

      if (!brand.gmail_connected || !brand.gmail_email) {
        return {
          error:
            "Gmail is not connected. Please connect Gmail in Settings → Integrations before sending outreach.",
        };
      }

      // 3. Load campaign if specified
      let campaign: Record<string, unknown> | null = null;
      if (params.campaign_id) {
        const { data } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", params.campaign_id)
          .eq("brand_id", brandId)
          .single();
        campaign = data as Record<string, unknown> | null;
      }

      // 4. Load caption intelligence for personalization
      const { data: captionIntelRaw } = await supabase
        .from("caption_intelligence")
        .select(
          "primary_niche, primary_tone, organic_brand_mentions, paid_brand_mentions"
        )
        .eq("creator_id", params.creator_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const captionIntel = captionIntelRaw as Record<string, unknown> | null;

      // 5. Load recent posts for context
      const { data: recentPostsRaw } = await supabase
        .from("posts")
        .select("description")
        .eq("creator_id", params.creator_id)
        .order("posted_at", { ascending: false })
        .limit(3);
      const recentPosts = (recentPostsRaw || []) as Record<string, unknown>[];

      // 6. Build merge context
      const mergeContext: MergeContext = {
        creator: {
          handle: creatorLb.handle as string,
          display_name: (creatorFull.display_name as string) ?? null,
          followers: (creatorLb.followers as number) ?? null,
          tier: (creatorLb.tier as string) ?? null,
          city: (creatorLb.city as string) ?? null,
          country: (creatorLb.country as string) ?? null,
          contact_email: (creatorFull.contact_email as string) ?? null,
          category: (creatorLb.primary_niche as string) ?? null,
        },
        creatorScores: {
          avg_engagement_rate: (creatorLb.avg_engagement_rate as number) ?? null,
          cpi: (creatorLb.cpi as number) ?? null,
        },
        captionIntelligence: {
          primary_niche: (captionIntel?.primary_niche as string) ?? null,
          primary_tone: (captionIntel?.primary_tone as string) ?? null,
          organic_brand_mentions:
            (captionIntel?.organic_brand_mentions as string[]) ?? [],
          paid_brand_mentions:
            (captionIntel?.paid_brand_mentions as string[]) ?? [],
        },
        posts: recentPosts.map((p: Record<string, unknown>) => ({
          description: p.description as string | null,
        })),
        brand: {
          brand_name: brand.brand_name as string,
          industry: (brand.industry as string) ?? null,
          website: (brand.website as string) ?? null,
          gmail_email: (brand.gmail_email as string) ?? null,
          product_categories: (brand.product_categories as string[]) ?? [],
          competitor_brands: (brand.competitor_brands as string[]) ?? [],
        },
        campaign: campaign
          ? {
              name: campaign.name as string,
              description: campaign.description as string | null,
              content_format: campaign.content_format as string | null,
              budget_per_creator: campaign.budget_per_creator as number | null,
              end_date: campaign.end_date as string | null,
            }
          : undefined,
        senderName: (brand.email_sender_name as string) || (brand.brand_name as string),
      };

      // 7. Load and resolve template
      let template: Record<string, unknown> | null = null;
      if (params.template_id) {
        const { data } = await supabase
          .from("outreach_templates")
          .select("*")
          .eq("id", params.template_id)
          .single();
        template = data as Record<string, unknown> | null;
      } else {
        // Find default cold outreach template
        const { data } = await supabase
          .from("outreach_templates")
          .select("*")
          .eq("brand_id", brandId)
          .eq("category", "cold_outreach")
          .eq("is_default", true)
          .limit(1)
          .single();
        template = data as Record<string, unknown> | null;
      }

      let subject: string;
      let body: string;

      if (template) {
        subject = resolveTemplate(
          (template.subject as string) || "",
          mergeContext
        );
        body = resolveTemplate(template.body as string, mergeContext);
      } else {
        // Fallback: simple template
        const hook = generatePersonalizationHook(mergeContext);
        const firstName =
          (creatorFull.display_name as string)?.split(" ")[0] ||
          creatorLb.handle;
        subject = `Collaboration opportunity — ${brand.brand_name as string} × @${creatorLb.handle as string}`;
        body = `Hi ${firstName},\n\n${hook}\n\nWe'd love to explore a collaboration with you. ${campaign ? `We're running a campaign "${campaign.name as string}" and think you'd be a great fit.` : `We think your content would resonate with our audience.`}\n\nWould love to chat if you're interested!\n\nBest,\n${(brand.email_sender_name as string) || (brand.brand_name as string)}`;
      }

      // 8. Save draft to outreach_messages
      const { data: message, error: insertError } = await supabase
        .from("outreach_messages")
        .insert({
          brand_id: brandId,
          creator_id: params.creator_id,
          campaign_id: params.campaign_id || null,
          template_id: params.template_id || template?.id || null,
          channel: "email",
          subject,
          body,
          recipient_email: creatorFull.contact_email,
          from_email: brand.gmail_email,
          sender_name: brand.email_sender_name || brand.brand_name,
          status: "draft",
          drafted_by: "agent",
        } as never)
        .select("id")
        .single();

      if (insertError) {
        return { error: `Failed to save draft: ${insertError.message}` };
      }

      const msg = message as Record<string, unknown> | null;
      return {
        draft_id: msg!.id,
        creator_handle: creatorLb.handle as string,
        creator_email: creatorFull.contact_email as string,
        subject,
        body,
        template_used: template
          ? (template.name as string)
          : "auto-generated",
        personalization_hook: generatePersonalizationHook(mergeContext),
        next_step:
          "Draft saved. Use propose_outreach with this draft_id to submit for approval before sending.",
      };
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Merge Field Engine                                                 */
/*  Resolves {{field_name}} placeholders in outreach templates         */
/* ------------------------------------------------------------------ */

export interface MergeContext {
  creator: {
    handle: string;
    display_name: string | null;
    followers: number | null;
    tier: string | null;
    city: string | null;
    country: string | null;
    contact_email: string | null;
    category: string | null;
  };
  creatorScores: {
    avg_engagement_rate: number | null;
    cpi: number | null;
  };
  captionIntelligence: {
    primary_niche: string | null;
    primary_tone: string | null;
    organic_brand_mentions: string[];
    paid_brand_mentions: string[];
  };
  posts: Array<{ description: string | null }>;
  brand: {
    brand_name: string;
    industry: string | null;
    website: string | null;
    gmail_email: string | null;
    product_categories: string[];
    competitor_brands: string[];
  };
  campaign?: {
    name: string;
    description: string | null;
    content_format: string | null;
    budget_per_creator: number | null;
    end_date: string | null;
  };
  senderName: string;
  discountCode?: string;
  discountPercent?: string;
  utmLink?: string;
  thread?: {
    subject: string | null;
    last_message_at: string | null;
  };
  agreedRate?: number | null;
}

/**
 * Format a number as K/M notation.
 */
export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${parseFloat(m.toFixed(1))}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return k % 1 === 0 ? `${k}K` : `${parseFloat(k.toFixed(1))}K`;
  }
  return String(n);
}

function capitalize(s: string | null): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function summarizePostTopic(description: string | null): string {
  if (!description) return "your recent content";
  // Take the first sentence or first 60 chars
  const firstSentence = description.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length <= 80) return firstSentence.toLowerCase();
  return description.substring(0, 60).trim().toLowerCase() + "...";
}

function formatDeliverable(campaign?: MergeContext["campaign"]): string {
  if (!campaign) return "";
  const format = campaign.content_format;
  if (!format || format === "any") return "content collaboration";
  const formatMap: Record<string, string> = {
    reels: "1 Instagram Reel (30-60 seconds)",
    static: "1 Static Instagram Post",
    carousel: "1 Instagram Carousel Post",
  };
  return formatMap[format] || format;
}

function formatCompensation(
  campaign?: MergeContext["campaign"],
  agreedRate?: number | null
): string {
  const rate = agreedRate ?? campaign?.budget_per_creator;
  if (!rate) return "";
  return `₹${rate.toLocaleString("en-IN")}`;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Generate a personalization hook from creator data, in priority order.
 */
export function generatePersonalizationHook(ctx: MergeContext): string {
  const { captionIntelligence, creatorScores, posts, brand, creator } = ctx;

  // Priority 1: Creator organically mentions brand's product category
  if (captionIntelligence.organic_brand_mentions?.length) {
    const match = captionIntelligence.organic_brand_mentions.find((m) =>
      brand.product_categories.some((c) => m.toLowerCase().includes(c.toLowerCase()))
    );
    if (match) {
      return `I noticed you mentioned ${match} organically — that's exactly the kind of authentic endorsement brands dream of`;
    }
  }

  // Priority 2: Creator mentions a competitor
  if (captionIntelligence.paid_brand_mentions?.length) {
    const competitorMatch = captionIntelligence.paid_brand_mentions.some((m) =>
      brand.competitor_brands?.some((c) =>
        m.toLowerCase().includes(c.toLowerCase())
      )
    );
    if (competitorMatch) {
      return `I saw you've worked with similar brands in the space — we think our product brings something different and your audience would appreciate the comparison`;
    }
  }

  // Priority 3: Reference their most recent post topic
  if (posts.length > 0 && posts[0].description) {
    const topic = summarizePostTopic(posts[0].description);
    return `your recent post about ${topic} really resonated with us`;
  }

  // Priority 4: Reference an impressive metric
  if (creatorScores.avg_engagement_rate && creatorScores.avg_engagement_rate > 5.0) {
    return `your engagement rate of ${creatorScores.avg_engagement_rate.toFixed(1)}% is seriously impressive for your tier — it tells us your followers genuinely trust your recommendations`;
  }

  // Priority 5: Reference their content style
  if (captionIntelligence.primary_tone) {
    return `your ${captionIntelligence.primary_tone} approach to ${captionIntelligence.primary_niche || creator.category || "content"} content is exactly the vibe our brand is going for`;
  }

  // Fallback
  return `your content consistently stands out in the ${captionIntelligence.primary_niche || creator.category || "creator"} space`;
}

/**
 * Resolve all {{field}} placeholders in a template string.
 * Unknown fields are left as-is.
 */
export function resolveTemplate(template: string, ctx: MergeContext): string {
  const fields: Record<string, string> = {
    first_name:
      ctx.creator.display_name?.split(" ")[0] || ctx.creator.handle,
    full_name: ctx.creator.display_name || ctx.creator.handle,
    handle: ctx.creator.handle,
    followers: formatNumber(ctx.creator.followers),
    tier: capitalize(ctx.creator.tier),
    engagement_rate: ctx.creatorScores.avg_engagement_rate != null
      ? `${ctx.creatorScores.avg_engagement_rate.toFixed(1)}%`
      : "",
    cpi_score: ctx.creatorScores.cpi != null ? String(ctx.creatorScores.cpi) : "",
    primary_niche: ctx.captionIntelligence.primary_niche || "your niche",
    city: ctx.creator.city || "",
    recent_post_topic: ctx.posts[0]
      ? summarizePostTopic(ctx.posts[0].description)
      : "your recent content",
    personalization_hook: generatePersonalizationHook(ctx),
    brand_name: ctx.brand.brand_name,
    brand_industry: ctx.brand.industry || "",
    brand_website: ctx.brand.website || "",
    sender_name: ctx.senderName,
    sender_email: ctx.brand.gmail_email || "",
    campaign_name: ctx.campaign?.name || "",
    deliverable_description: formatDeliverable(ctx.campaign),
    compensation_description: formatCompensation(ctx.campaign, ctx.agreedRate),
    product_name: "",
    discount_code: ctx.discountCode || "",
    discount_percent: ctx.discountPercent || "",
    utm_link: ctx.utmLink || "",
    content_deadline: ctx.campaign?.end_date
      ? new Date(
          new Date(ctx.campaign.end_date).getTime() - 10 * 24 * 60 * 60 * 1000
        ).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "",
    days_since_outreach: ctx.thread?.last_message_at
      ? String(
          daysBetween(new Date(ctx.thread.last_message_at), new Date())
        )
      : "",
    original_subject: ctx.thread?.subject || "",
    one_line_pitch: ctx.campaign?.description?.split(".")[0] || "",
    brief_summary: "",
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    return fields[field] ?? match;
  });
}

import { describe, it, expect } from "vitest";
import {
  resolveTemplate,
  formatNumber,
  generatePersonalizationHook,
  type MergeContext,
} from "../merge-fields";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeMergeContext(overrides?: Partial<MergeContext>): MergeContext {
  return {
    creator: {
      handle: "fit_priya",
      display_name: "Priya Sharma",
      followers: 38200,
      tier: "micro",
      city: "Mumbai",
      country: "India",
      contact_email: "priya@email.com",
      category: "fitness",
    },
    creatorScores: {
      avg_engagement_rate: 5.1,
      cpi: 86,
    },
    captionIntelligence: {
      primary_niche: "fitness",
      primary_tone: "casual",
      organic_brand_mentions: [],
      paid_brand_mentions: [],
    },
    posts: [
      {
        description:
          "Post-workout nutrition tips for busy professionals. Here's how to hit your macros without spending hours in the kitchen.",
      },
    ],
    brand: {
      brand_name: "FitBar India",
      industry: "health food",
      website: "https://fitbar.in",
      gmail_email: "naman@fitbar.in",
      product_categories: ["protein bars", "health food"],
      competitor_brands: ["Yoga Bar", "RiteBite"],
    },
    campaign: {
      name: "Summer Collection 2026",
      description:
        "A reel featuring our new protein bar. Summer launch campaign targeting fitness creators.",
      content_format: "reels",
      budget_per_creator: 15000,
      end_date: "2026-07-15",
    },
    senderName: "Naman",
    discountCode: "PRIYA15",
    discountPercent: "15",
    utmLink: "https://fitbar.in?utm_source=instagram&utm_medium=influencer",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  formatNumber                                                       */
/* ------------------------------------------------------------------ */

describe("formatNumber", () => {
  it("formats thousands as K", () => {
    expect(formatNumber(38200)).toBe("38.2K");
    expect(formatNumber(1000)).toBe("1K");
    expect(formatNumber(1500)).toBe("1.5K");
  });

  it("formats millions as M", () => {
    expect(formatNumber(1200000)).toBe("1.2M");
    expect(formatNumber(5000000)).toBe("5M");
  });

  it("leaves small numbers as-is", () => {
    expect(formatNumber(500)).toBe("500");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(0)).toBe("0");
  });

  it("handles null/undefined", () => {
    expect(formatNumber(null)).toBe("0");
    expect(formatNumber(undefined)).toBe("0");
  });
});

/* ------------------------------------------------------------------ */
/*  resolveTemplate                                                    */
/* ------------------------------------------------------------------ */

describe("resolveTemplate", () => {
  it("replaces basic merge fields", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate("Hi {{first_name}}, I'm {{sender_name}} from {{brand_name}}.", ctx);
    expect(result).toBe("Hi Priya, I'm Naman from FitBar India.");
  });

  it("replaces creator-specific fields", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate(
      "Your handle @{{handle}} has {{followers}} followers ({{tier}} tier).",
      ctx
    );
    expect(result).toBe(
      "Your handle @fit_priya has 38.2K followers (Micro tier)."
    );
  });

  it("replaces performance fields", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate(
      "Engagement: {{engagement_rate}}, CPI: {{cpi_score}}",
      ctx
    );
    expect(result).toBe("Engagement: 5.1%, CPI: 86");
  });

  it("replaces brand fields", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate(
      "{{brand_name}} ({{brand_industry}}) — {{brand_website}}",
      ctx
    );
    expect(result).toBe("FitBar India (health food) — https://fitbar.in");
  });

  it("replaces campaign fields", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate(
      "Campaign: {{campaign_name}} — {{one_line_pitch}}",
      ctx
    );
    expect(result).toContain("Summer Collection 2026");
    expect(result).toContain("A reel featuring our new protein bar");
  });

  it("replaces discount and UTM fields", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate(
      "Code: {{discount_code}} ({{discount_percent}}% off) — {{utm_link}}",
      ctx
    );
    expect(result).toBe(
      "Code: PRIYA15 (15% off) — https://fitbar.in?utm_source=instagram&utm_medium=influencer"
    );
  });

  it("replaces sender and email fields", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate("From: {{sender_name}} ({{sender_email}})", ctx);
    expect(result).toBe("From: Naman (naman@fitbar.in)");
  });

  it("replaces full_name and city", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate("{{full_name}} from {{city}}", ctx);
    expect(result).toBe("Priya Sharma from Mumbai");
  });

  it("replaces primary_niche", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate("your {{primary_niche}} content", ctx);
    expect(result).toBe("your fitness content");
  });

  it("leaves unknown merge fields as-is", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate("Hello {{unknown_field}}", ctx);
    expect(result).toBe("Hello {{unknown_field}}");
  });

  it("handles template with no merge fields", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate("Just a plain message.", ctx);
    expect(result).toBe("Just a plain message.");
  });

  it("handles empty template", () => {
    const ctx = makeMergeContext();
    expect(resolveTemplate("", ctx)).toBe("");
  });

  it("handles multiple occurrences of same field", () => {
    const ctx = makeMergeContext();
    const result = resolveTemplate("Hi {{first_name}}! Yes, {{first_name}}!", ctx);
    expect(result).toBe("Hi Priya! Yes, Priya!");
  });

  it("uses handle as fallback for first_name when no display_name", () => {
    const ctx = makeMergeContext({
      creator: {
        handle: "fit_priya",
        display_name: null,
        followers: 38200,
        tier: "micro",
        city: "Mumbai",
        country: "India",
        contact_email: "priya@email.com",
        category: "fitness",
      },
    });
    const result = resolveTemplate("Hi {{first_name}}", ctx);
    expect(result).toBe("Hi fit_priya");
  });

  it("handles missing optional context gracefully", () => {
    const ctx = makeMergeContext({
      campaign: undefined,
      discountCode: undefined,
      utmLink: undefined,
    });
    const result = resolveTemplate(
      "Campaign: {{campaign_name}}, Code: {{discount_code}}",
      ctx
    );
    expect(result).toBe("Campaign: , Code: ");
  });
});

/* ------------------------------------------------------------------ */
/*  generatePersonalizationHook                                        */
/* ------------------------------------------------------------------ */

describe("generatePersonalizationHook", () => {
  it("returns organic brand mention hook when matching", () => {
    const ctx = makeMergeContext({
      captionIntelligence: {
        primary_niche: "fitness",
        primary_tone: "casual",
        organic_brand_mentions: ["protein bars"],
        paid_brand_mentions: [],
      },
    });
    const hook = generatePersonalizationHook(ctx);
    expect(hook).toContain("protein bars");
    expect(hook).toContain("authentic");
  });

  it("returns competitor mention hook when matching", () => {
    const ctx = makeMergeContext({
      captionIntelligence: {
        primary_niche: "fitness",
        primary_tone: "casual",
        organic_brand_mentions: [],
        paid_brand_mentions: ["Yoga Bar"],
      },
    });
    const hook = generatePersonalizationHook(ctx);
    expect(hook).toContain("similar brands");
  });

  it("returns recent post topic hook when no brand mentions", () => {
    const ctx = makeMergeContext({
      captionIntelligence: {
        primary_niche: "fitness",
        primary_tone: "casual",
        organic_brand_mentions: [],
        paid_brand_mentions: [],
      },
    });
    const hook = generatePersonalizationHook(ctx);
    expect(hook).toContain("recent post");
  });

  it("returns engagement rate hook for high engagement", () => {
    const ctx = makeMergeContext({
      posts: [],
      captionIntelligence: {
        primary_niche: "fitness",
        primary_tone: null,
        organic_brand_mentions: [],
        paid_brand_mentions: [],
      },
      creatorScores: {
        avg_engagement_rate: 6.5,
        cpi: 90,
      },
    });
    const hook = generatePersonalizationHook(ctx);
    expect(hook).toContain("6.5%");
  });

  it("returns tone hook when no other signals", () => {
    const ctx = makeMergeContext({
      posts: [],
      creatorScores: { avg_engagement_rate: 2.0, cpi: 50 },
      captionIntelligence: {
        primary_niche: "fitness",
        primary_tone: "casual",
        organic_brand_mentions: [],
        paid_brand_mentions: [],
      },
    });
    const hook = generatePersonalizationHook(ctx);
    expect(hook).toContain("casual");
  });

  it("returns generic fallback when no signals at all", () => {
    const ctx = makeMergeContext({
      posts: [],
      creatorScores: { avg_engagement_rate: 2.0, cpi: 50 },
      captionIntelligence: {
        primary_niche: null,
        primary_tone: null,
        organic_brand_mentions: [],
        paid_brand_mentions: [],
      },
    });
    const hook = generatePersonalizationHook(ctx);
    expect(hook).toContain("stands out");
  });
});

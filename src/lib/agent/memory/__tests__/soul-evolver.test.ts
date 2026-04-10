import { describe, it, expect } from "vitest";
import { parseSoulMd, formatRulesSection } from "../soul-evolver";

/* ------------------------------------------------------------------ */
/*  parseSoulMd tests                                                  */
/* ------------------------------------------------------------------ */

describe("parseSoulMd", () => {
  it("returns full content as base when no rules marker exists", () => {
    const soulMd = `# Agent Personality\nYou are a helpful assistant.\n\n## Guidelines\n- Be concise`;
    const { base, rules } = parseSoulMd(soulMd);

    expect(base).toBe(soulMd.trimEnd());
    expect(rules).toBe("");
  });

  it("splits at the rules marker", () => {
    const soulMd = `# Agent Personality\nYou are a helpful assistant.\n\n## Learned Decision Rules\n\n### Outreach\n- Send on Tuesdays (70% confidence, 10 data points)`;
    const { base, rules } = parseSoulMd(soulMd);

    expect(base).toBe("# Agent Personality\nYou are a helpful assistant.");
    expect(rules).toContain("## Learned Decision Rules");
    expect(rules).toContain("Send on Tuesdays");
  });

  it("preserves human-written content above the marker", () => {
    const humanPart = `# Personality\n\nI am the FitBar marketing assistant.\n\n## Communication Style\n- Professional but friendly\n- Data-driven\n- Use INR currency`;
    const rulesPart = `\n\n## Learned Decision Rules\n\n### Outreach\n- Tuesdays are best`;
    const soulMd = humanPart + rulesPart;

    const { base } = parseSoulMd(soulMd);
    expect(base).toBe(humanPart.trimEnd());
  });

  it("handles empty SOUL.md", () => {
    const { base, rules } = parseSoulMd("");
    expect(base).toBe("");
    expect(rules).toBe("");
  });

  it("handles SOUL.md that is only the marker", () => {
    const { base, rules } = parseSoulMd("## Learned Decision Rules");
    expect(base).toBe("");
    expect(rules).toBe("## Learned Decision Rules");
  });
});

/* ------------------------------------------------------------------ */
/*  formatRulesSection tests                                           */
/* ------------------------------------------------------------------ */

describe("formatRulesSection", () => {
  it("returns empty string for no items", () => {
    expect(formatRulesSection([])).toBe("");
  });

  it("groups items by category", () => {
    const items = [
      {
        id: "1",
        knowledge_type: "outreach_pattern",
        fact: "Send outreach on Tuesday-Thursday mornings",
        confidence: 0.68,
        evidence_count: 23,
      },
      {
        id: "2",
        knowledge_type: "rate_benchmark",
        fact: "Micro fitness creators median ₹12-18K per reel",
        confidence: 0.91,
        evidence_count: 12,
      },
      {
        id: "3",
        knowledge_type: "niche_insight",
        fact: "UGC outperforms polished content for this brand",
        confidence: 0.78,
        evidence_count: 8,
      },
    ];

    const result = formatRulesSection(items);

    expect(result).toContain("## Learned Decision Rules");
    expect(result).toContain("### Outreach");
    expect(result).toContain("### Negotiation");
    expect(result).toContain("### Creator Selection");
    expect(result).toContain("Tuesday-Thursday");
    expect(result).toContain("68% confidence, 23 data points");
    expect(result).toContain("91% confidence, 12 data points");
  });

  it("formats confidence as rounded percentage", () => {
    const items = [
      {
        id: "1",
        knowledge_type: "brand_preference",
        fact: "Brand rejects colorful aesthetics",
        confidence: 0.856,
        evidence_count: 5,
      },
    ];

    const result = formatRulesSection(items);
    expect(result).toContain("86% confidence");
  });

  it("assigns unknown types to General category", () => {
    const items = [
      {
        id: "1",
        knowledge_type: "unknown_type" as any,
        fact: "Some general insight",
        confidence: 0.7,
        evidence_count: 4,
      },
    ];

    const result = formatRulesSection(items);
    expect(result).toContain("### General");
  });

  it("includes all items even with mixed categories", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      knowledge_type: [
        "outreach_pattern",
        "timing_pattern",
        "niche_insight",
        "rate_benchmark",
        "brand_preference",
      ][i],
      fact: `Fact number ${i + 1}`,
      confidence: 0.7 + i * 0.05,
      evidence_count: 3 + i,
    }));

    const result = formatRulesSection(items);

    for (let i = 0; i < 5; i++) {
      expect(result).toContain(`Fact number ${i + 1}`);
    }
  });
});

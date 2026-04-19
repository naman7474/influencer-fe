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

  it("groups content_performance under Brand Preferences", () => {
    const items = [
      {
        id: "1",
        knowledge_type: "content_performance",
        fact: "Reels perform 2x better than carousels",
        confidence: 0.82,
        evidence_count: 7,
      },
    ];
    const result = formatRulesSection(items);
    expect(result).toContain("### Brand Preferences");
  });

  it("groups negotiation_strategy under Negotiation", () => {
    const items = [
      {
        id: "1",
        knowledge_type: "negotiation_strategy",
        fact: "Start with 10% discount offer",
        confidence: 0.88,
        evidence_count: 6,
      },
    ];
    const result = formatRulesSection(items);
    expect(result).toContain("### Negotiation");
  });

  it("groups timing_pattern under Outreach", () => {
    const items = [
      {
        id: "1",
        knowledge_type: "timing_pattern",
        fact: "Post at 6pm IST for highest engagement",
        confidence: 0.72,
        evidence_count: 4,
      },
    ];
    const result = formatRulesSection(items);
    expect(result).toContain("### Outreach");
  });
});

/* ------------------------------------------------------------------ */
/*  evolveSoulMd tests                                                 */
/* ------------------------------------------------------------------ */

import { vi } from "vitest";
import { evolveSoulMd } from "../soul-evolver";

function createMockSupabase(
  config: Record<string, unknown> | null,
  knowledge: unknown[]
) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "agent_config") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: config, error: null }),
          }),
        }),
        update: updateFn,
      };
    }
    if (table === "agent_knowledge") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: knowledge,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    return {};
  });

  return {
    from: fromFn,
    _update: updateFn,
  };
}

describe("evolveSoulMd", () => {
  it("returns not updated when config is null", async () => {
    const mock = createMockSupabase(null, []);
    const result = await evolveSoulMd(
      "brand-1",
      mock as unknown as Parameters<typeof evolveSoulMd>[1]
    );
    expect(result).toEqual({ updated: false, ruleCount: 0 });
  });

  it("returns not updated when no high-confidence knowledge exists", async () => {
    const mock = createMockSupabase({ soul_md: "# Brand\nHello" }, []);
    const result = await evolveSoulMd(
      "brand-1",
      mock as unknown as Parameters<typeof evolveSoulMd>[1]
    );
    expect(result.updated).toBe(false);
    expect(result.ruleCount).toBe(0);
  });

  it("updates soul_md when new knowledge rules are generated", async () => {
    const knowledge = [
      {
        id: "k1",
        knowledge_type: "outreach_pattern",
        fact: "Send outreach on Tuesday mornings",
        confidence: 0.85,
        evidence_count: 5,
      },
    ];
    const mock = createMockSupabase(
      { soul_md: "# Brand Persona\nI am a fitness brand." },
      knowledge
    );
    const result = await evolveSoulMd(
      "brand-1",
      mock as unknown as Parameters<typeof evolveSoulMd>[1]
    );
    expect(result.updated).toBe(true);
    expect(result.ruleCount).toBe(1);
    // Verify update was called
    expect(mock._update).toHaveBeenCalled();
  });

  it("handles empty soul_md string in config", async () => {
    const knowledge = [
      {
        id: "k1",
        knowledge_type: "niche_insight",
        fact: "Fitness niche works best in January",
        confidence: 0.75,
        evidence_count: 4,
      },
    ];
    const mock = createMockSupabase({ soul_md: "" }, knowledge);
    const result = await evolveSoulMd(
      "brand-1",
      mock as unknown as Parameters<typeof evolveSoulMd>[1]
    );
    expect(result.updated).toBe(true);
    expect(result.ruleCount).toBe(1);
  });

  it("handles null soul_md field in config", async () => {
    const knowledge = [
      {
        id: "k1",
        knowledge_type: "rate_benchmark",
        fact: "Nano tier rates are 1k-5k",
        confidence: 0.9,
        evidence_count: 10,
      },
    ];
    const mock = createMockSupabase({ soul_md: null }, knowledge);
    const result = await evolveSoulMd(
      "brand-1",
      mock as unknown as Parameters<typeof evolveSoulMd>[1]
    );
    expect(result.updated).toBe(true);
    expect(result.ruleCount).toBe(1);
  });

  it("does not update when content is unchanged", async () => {
    // Build what the soul_md would look like with rules already applied
    const knowledge = [
      {
        id: "k1",
        knowledge_type: "outreach_pattern",
        fact: "Send outreach on Tuesday mornings",
        confidence: 0.85,
        evidence_count: 5,
      },
    ];
    const rulesSection = formatRulesSection(knowledge);
    const fullSoulMd = `# Brand\n\n${rulesSection}`;

    const mock = createMockSupabase({ soul_md: fullSoulMd }, knowledge);
    const result = await evolveSoulMd(
      "brand-1",
      mock as unknown as Parameters<typeof evolveSoulMd>[1]
    );
    expect(result.updated).toBe(false);
    expect(result.ruleCount).toBe(1);
    // update should NOT be called since content is the same
    expect(mock._update).not.toHaveBeenCalled();
  });
});

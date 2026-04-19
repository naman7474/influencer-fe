import { describe, it, expect, vi } from "vitest";
import { counterOfferGeneratorTool } from "../counter-offer-generator";
import { budgetOptimizerTool } from "../budget-optimizer";
import { dealMemoGeneratorTool } from "../deal-memo-generator";
import { rateBenchmarkerTool } from "../rate-benchmarker";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or", "not",
    "order", "limit", "upsert", "insert", "update",
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => {
    isSingle = true;
    return builder;
  });
  builder.then = (resolve: (v: unknown) => void) => {
    if (isSingle) {
      const singleData =
        Array.isArray(data) && data.length > 0 ? data[0] : null;
      resolve({ data: singleData, error });
    } else {
      resolve({ data, error });
    }
  };
  return builder;
}

type SupabaseParam = Parameters<typeof counterOfferGeneratorTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ------------------------------------------------------------------ */
/*  Counter Offer Generator                                            */
/* ------------------------------------------------------------------ */

describe("counter-offer-generator", () => {
  const brandId = "brand-1";

  it("returns error when creator not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = counterOfferGeneratorTool(brandId, supabase);
    const result = await t.execute(
      { campaign_id: "camp-1", creator_id: "missing", creator_ask: 50000 },
      execOpts
    );
    expect(result).toHaveProperty("error", "Creator not found");
  });

  it("recommends accepting when ask is below market median", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              id: "c1",
              handle: "@creator1",
              display_name: "C1",
              followers: 50000,
              tier: "mid",
              cpi: 72,
              avg_engagement_rate: 4.0,
              primary_niche: "beauty",
            },
          ]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", budget: 200000 },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", agreed_rate: null, negotiation_status: null },
          ]);
        }
        if (table === "negotiations") {
          const b = mockQueryBuilder([]);
          b.insert = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = counterOfferGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", creator_ask: 30000 },
      execOpts
    )) as {
      negotiation: { recommended_counter: number; justification: string };
      market_context: { market_median: number };
    };

    // Mid-tier median is 45000, ask of 30000 is below → should accept
    expect(result.negotiation.recommended_counter).toBe(30000);
    expect(result.negotiation.justification).toContain("below market median");
  });

  it("counters premium creator within market range (90% of ask)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              id: "c1", handle: "@premium", display_name: "Premium",
              followers: 80000, tier: "mid", cpi: 85,
              avg_engagement_rate: 5.0, primary_niche: "fitness",
            },
          ]);
        }
        if (table === "campaigns") return mockQueryBuilder([{ id: "camp-1", name: "Test", budget: 500000 }]);
        if (table === "campaign_creators") return mockQueryBuilder([{ id: "cc1" }]);
        if (table === "negotiations") {
          const b = mockQueryBuilder([]);
          b.insert = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = counterOfferGeneratorTool(brandId, supabase);
    // Mid tier median ~45000 (with CPI 85 adj +20% = ~54000), max ~67500
    // Ask of 60000 is below max but above median, and CPI >= 70
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", creator_ask: 60000 },
      execOpts
    )) as { negotiation: { recommended_counter: number; justification: string } };

    expect(result.negotiation.justification).toContain("High-CPI creator");
    expect(result.negotiation.recommended_counter).toBe(Math.round(60000 * 0.9));
  });

  it("splits difference for standard within-range ask", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              id: "c1", handle: "@standard", display_name: "Standard",
              followers: 30000, tier: "mid", cpi: 55, // CPI < 70 → won't take premium path
              avg_engagement_rate: 3.5, primary_niche: "lifestyle",
            },
          ]);
        }
        if (table === "campaigns") return mockQueryBuilder([{ id: "camp-1", name: "Test", budget: 200000 }]);
        if (table === "campaign_creators") return mockQueryBuilder([{ id: "cc1" }]);
        if (table === "negotiations") {
          const b = mockQueryBuilder([]);
          b.insert = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = counterOfferGeneratorTool(brandId, supabase);
    // Mid tier with CPI 55 → adj ~0.85, median ~38250, max ~47812
    // Ask 42000 is above median, below max, CPI < 70 → "standard counter" path
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", creator_ask: 42000 },
      execOpts
    )) as { negotiation: { recommended_counter: number; justification: string } };

    expect(result.negotiation.justification).toContain("Splitting the difference");
  });

  it("caps counter at brand_max", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              id: "c1", handle: "@capped", display_name: "Capped",
              followers: 50000, tier: "mid", cpi: 72,
              avg_engagement_rate: 4.0, primary_niche: "beauty",
            },
          ]);
        }
        if (table === "campaigns") return mockQueryBuilder([{ id: "camp-1", name: "Test", budget: 100000 }]);
        if (table === "campaign_creators") return mockQueryBuilder([{ id: "cc1" }]);
        if (table === "negotiations") {
          const b = mockQueryBuilder([]);
          b.insert = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = counterOfferGeneratorTool(brandId, supabase);
    // brand_max of 20000 is very low, will cap the counter
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", creator_ask: 30000, brand_max: 20000 },
      execOpts
    )) as { negotiation: { recommended_counter: number; justification: string } };

    expect(result.negotiation.recommended_counter).toBeLessThanOrEqual(20000);
    expect(result.negotiation.justification).toContain("Capped");
  });

  it("counters above-market asks", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              id: "c1",
              handle: "@creator1",
              followers: 15000,
              tier: "micro",
              cpi: 55,
              avg_engagement_rate: 3.0,
              primary_niche: "fashion",
            },
          ]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", budget: 100000 },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([{ id: "cc1" }]);
        }
        if (table === "negotiations") {
          const b = mockQueryBuilder([]);
          b.insert = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = counterOfferGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", creator_ask: 50000 },
      execOpts
    )) as {
      negotiation: { recommended_counter: number; creator_ask: number };
      market_context: { market_max: number };
    };

    // Micro max is ~25000 (with 0.85 CPI adj = ~21250), ask of 50000 is way over
    expect(result.negotiation.recommended_counter).toBeLessThan(50000);
    expect(result.negotiation.recommended_counter).toBeLessThan(
      result.market_context.market_max
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Budget Optimizer                                                   */
/* ------------------------------------------------------------------ */

describe("budget-optimizer", () => {
  const brandId = "brand-1";

  it("returns error when no budget set", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", budget: 0, status: "active" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = budgetOptimizerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1" },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("No budget set");
  });

  it("calculates budget breakdown correctly", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Summer Sale", total_budget: 200000, status: "active" },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            {
              id: "cc1",
              creator_id: "c1",
              status: "confirmed",
              agreed_rate: 50000,
              negotiation_status: null,
              creators: { handle: "@c1", tier: "mid" },
            },
            {
              id: "cc2",
              creator_id: "c2",
              status: "confirmed",
              agreed_rate: 30000,
              negotiation_status: "negotiating",
              creators: { handle: "@c2", tier: "micro" },
            },
            {
              id: "cc3",
              creator_id: "c3",
              status: "shortlisted",
              agreed_rate: null,
              negotiation_status: null,
              creators: { handle: "@c3", tier: "micro" },
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = budgetOptimizerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1" },
      execOpts
    )) as {
      budget_summary: {
        total_budget: number;
        confirmed_spend: number;
        negotiating_spend: number;
        reserved_for_shortlisted: number;
        budget_used_percent: number;
      };
      creator_breakdown: {
        confirmed: number;
        negotiating: number;
        shortlisted: number;
      };
    };

    expect(result.budget_summary.total_budget).toBe(200000);
    expect(result.budget_summary.confirmed_spend).toBe(50000); // only cc1 (cc2 is negotiating)
    expect(result.budget_summary.budget_used_percent).toBe(25);
    // confirmed count = creators with status "confirmed" AND agreed_rate > 0 (both cc1 and cc2)
    expect(result.creator_breakdown.confirmed).toBe(2);
    expect(result.creator_breakdown.negotiating).toBe(1);
    expect(result.creator_breakdown.shortlisted).toBe(1);
  });

  it("generates warnings when budget is over-committed", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", total_budget: 60000, status: "active" },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            {
              id: "cc1",
              creator_id: "c1",
              status: "confirmed",
              agreed_rate: 55000,
              negotiation_status: null,
              creators: { handle: "@c1", tier: "mid" },
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = budgetOptimizerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1" },
      execOpts
    )) as { warnings: string[] | null; budget_summary: { budget_used_percent: number } };

    expect(result.budget_summary.budget_used_percent).toBeGreaterThan(90);
    expect(result.warnings).not.toBeNull();
    expect(result.warnings!.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Deal Memo Generator                                                */
/* ------------------------------------------------------------------ */

describe("deal-memo-generator", () => {
  const brandId = "brand-1";

  it("returns error when creator not in campaign", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", start_date: "2025-06-01", end_date: "2025-07-01" },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@c1", display_name: "C1", followers: 50000, tier: "mid" },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]); // not in campaign
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = dealMemoGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      {
        campaign_id: "camp-1",
        creator_id: "c1",
        agreed_rate: 50000,
      },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("not part of this campaign");
  });

  it("generates and stores a deal memo", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Summer Launch", start_date: "2025-06-01", end_date: "2025-07-01" },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@beauty_queen", display_name: "Beauty Queen", followers: 50000, tier: "mid" },
          ]);
        }
        if (table === "campaign_creators") {
          const b = mockQueryBuilder([{ id: "cc1" }]);
          b.update = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        if (table === "negotiations") {
          const b = mockQueryBuilder([
            { round_number: 1, brand_offer: 40000, creator_ask: 60000, action_taken: "agent_counter" },
            { round_number: 2, brand_offer: 50000, creator_ask: 55000, action_taken: "accept" },
          ]);
          b.update = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        if (table === "deal_memos") {
          return mockQueryBuilder([{ id: "memo-1" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = dealMemoGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      {
        campaign_id: "camp-1",
        creator_id: "c1",
        agreed_rate: 50000,
        content_deliverables: [
          { type: "reel", quantity: 2 },
          { type: "story", quantity: 3 },
        ],
        usage_rights: "30 days organic + paid",
        exclusivity_period: "60 days",
        payment_terms: "50% upfront, 50% on delivery",
        special_notes: "Must include unboxing",
      },
      execOpts
    )) as {
      memo_id: string;
      deal_memo: {
        campaign: string;
        creator: { handle: string };
        terms: {
          agreed_rate: number;
          content_deliverables: { type: string; quantity: number }[];
          usage_rights: string;
          exclusivity_period: string;
        };
        negotiation_summary: { total_rounds: number };
      };
    };

    expect(result.memo_id).toBe("memo-1");
    expect(result.deal_memo.campaign).toBe("Summer Launch");
    expect(result.deal_memo.creator.handle).toBe("@beauty_queen");
    expect(result.deal_memo.terms.agreed_rate).toBe(50000);
    expect(result.deal_memo.terms.content_deliverables).toHaveLength(2);
    expect(result.deal_memo.terms.usage_rights).toBe("30 days organic + paid");
    expect(result.deal_memo.terms.exclusivity_period).toBe("60 days");
    expect(result.deal_memo.negotiation_summary.total_rounds).toBe(2);
  });

  it("uses defaults for optional params", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Default Test", start_date: "2025-06-01", end_date: "2025-07-01" },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@min", display_name: "Min", followers: 10000, tier: "nano" },
          ]);
        }
        if (table === "campaign_creators") {
          const b = mockQueryBuilder([{ id: "cc1" }]);
          b.update = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        if (table === "negotiations") {
          const b = mockQueryBuilder([]);
          b.update = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        if (table === "deal_memos") {
          return mockQueryBuilder([{ id: "memo-2" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = dealMemoGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      {
        campaign_id: "camp-1",
        creator_id: "c1",
        agreed_rate: 15000,
        // No optional params: content_deliverables, usage_rights, exclusivity_period, payment_terms, special_notes
      },
      execOpts
    )) as {
      deal_memo: {
        terms: {
          usage_rights: string;
          exclusivity_period: string;
          payment_terms: string;
          special_notes: string | null;
          content_deliverables: unknown[];
        };
        negotiation_summary: { total_rounds: number };
      };
    };

    expect(result.deal_memo.terms.usage_rights).toBe("Standard organic use");
    expect(result.deal_memo.terms.exclusivity_period).toBe("None");
    expect(result.deal_memo.terms.payment_terms).toBe("Full payment on content approval");
    expect(result.deal_memo.terms.special_notes).toBeNull();
    expect(result.deal_memo.terms.content_deliverables).toEqual([]);
    expect(result.deal_memo.negotiation_summary.total_rounds).toBe(0);
  });

  it("returns error when memo upsert fails", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([{ id: "camp-1", name: "Err", start_date: "2025-06-01", end_date: "2025-07-01" }]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([{ id: "c1", handle: "@err", display_name: "Err", followers: 10000, tier: "nano" }]);
        }
        if (table === "campaign_creators") {
          const b = mockQueryBuilder([{ id: "cc1" }]);
          b.update = vi.fn().mockReturnValue(mockQueryBuilder([]));
          return b;
        }
        if (table === "negotiations") return mockQueryBuilder([]);
        if (table === "deal_memos") return mockQueryBuilder([], { message: "upsert failed" });
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = dealMemoGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", agreed_rate: 15000 },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("Failed to save deal memo");
  });
});

/* ------------------------------------------------------------------ */
/*  Rate Benchmarker                                                   */
/* ------------------------------------------------------------------ */

describe("rate-benchmarker", () => {
  it("returns market rates for a tier (no creator_id)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      { tier: "micro" },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    expect(result.tier).toBe("micro");
    expect(result.market_rate).toBeDefined();
    const rate = result.market_rate as Record<string, unknown>;
    expect(rate.min).toBeGreaterThan(0);
    expect(rate.median).toBeGreaterThanOrEqual(rate.min as number);
    expect(rate.max).toBeGreaterThanOrEqual(rate.median as number);
    expect(rate.currency).toBe("INR");
    expect(result.creator_specific).toBeNull();
  });

  it("returns creator-specific data when creator_id provided", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([{
            creator_id: "c-1",
            handle: "beauty_queen",
            tier: "micro",
            followers: 45000,
            cpi: 82,
            avg_engagement_rate: 4.5,
            primary_niche: "beauty",
          }]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      { creator_id: "c-1" },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    expect(result.tier).toBe("micro");
    expect(result.creator_specific).toBeDefined();
    const specific = result.creator_specific as Record<string, unknown>;
    expect(specific.handle).toBe("beauty_queen");
    expect(specific.cpi).toBe(82);
    expect(specific.cpi_adjustment).toContain("premium");
  });

  it("applies low CPI discount", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([{
            creator_id: "c-2",
            handle: "low_cpi",
            tier: "nano",
            cpi: 40,
            avg_engagement_rate: 1.5,
            primary_niche: "gaming",
          }]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      { creator_id: "c-2" },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    const specific = result.creator_specific as Record<string, unknown>;
    expect(specific.cpi_adjustment).toContain("discount");
  });

  it("applies format multiplier for reels", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") return mockQueryBuilder([]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      { tier: "micro", content_format: "reels" },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    const rate = result.market_rate as Record<string, unknown>;
    // Reels have 1.15x multiplier, so rates should be above base micro median (15000)
    expect(rate.median).toBeGreaterThan(15000);
  });

  it("applies format multiplier for static posts", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") return mockQueryBuilder([]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      { tier: "micro", content_format: "static" },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    const rate = result.market_rate as Record<string, unknown>;
    // Static has 0.75x multiplier, so rates should be below base micro median (15000)
    expect(rate.median).toBeLessThan(15000);
  });

  it("applies format multiplier for carousel", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") return mockQueryBuilder([]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      { tier: "macro", content_format: "carousel" },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    expect(result.content_format).toBe("carousel");
  });

  it("includes brand historical rates when available", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { agreed_rate: 20000, creator_id: "c1", creators: { tier: "micro" }, campaigns: { brand_id: "brand-1" } },
            { agreed_rate: 18000, creator_id: "c2", creators: { tier: "micro" }, campaigns: { brand_id: "brand-1" } },
            { agreed_rate: 100000, creator_id: "c3", creators: { tier: "macro" }, campaigns: { brand_id: "brand-1" } },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      { tier: "micro" },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    const hist = result.brand_historical as Record<string, unknown>;
    expect(hist.total_past_deals).toBe(2);
    expect(hist.avg_rate_paid).toBe(19000); // avg of 20000 and 18000
    expect(hist.note).toContain("₹19,000");
  });

  it("handles no historical deals", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") return mockQueryBuilder([]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      { tier: "mega" },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    const hist = result.brand_historical as Record<string, unknown>;
    expect(hist.avg_rate_paid).toBeNull();
    expect(hist.total_past_deals).toBe(0);
    expect(hist.note).toContain("No past");
  });

  it("defaults to micro when no tier provided and no creator data", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") return mockQueryBuilder([]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      {},
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    expect(result.tier).toBe("micro");
  });

  it("handles CPI at boundary (60)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([{
            creator_id: "c-3",
            handle: "mid_cpi",
            tier: "mid",
            cpi: 60,
            avg_engagement_rate: 3.0,
            primary_niche: "tech",
          }]);
        }
        if (table === "campaign_creators") return mockQueryBuilder([]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool("brand-1", supabase);
    const result = (await t.execute!(
      { creator_id: "c-3" },
      { toolCallId: "tc-1", messages: [], abortSignal: new AbortController().signal }
    )) as Record<string, unknown>;

    const specific = result.creator_specific as Record<string, unknown>;
    expect(specific.cpi_adjustment).toBe("market rate");
  });
});

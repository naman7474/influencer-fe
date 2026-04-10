import { describe, it, expect, vi } from "vitest";
import { counterOfferGeneratorTool } from "../counter-offer-generator";
import { budgetOptimizerTool } from "../budget-optimizer";
import { dealMemoGeneratorTool } from "../deal-memo-generator";

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
            { id: "camp-1", name: "Summer Sale", budget: 200000, status: "active" },
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
            { id: "camp-1", name: "Test", budget: 60000, status: "active" },
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
});

import { describe, it, expect, vi } from "vitest";
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
    "order", "limit",
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

type SupabaseParam = Parameters<typeof rateBenchmarkerTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ------------------------------------------------------------------ */
/*  Rate Benchmarker                                                   */
/* ------------------------------------------------------------------ */

describe("rate-benchmarker", () => {
  const brandId = "brand-1";

  /* ── Tier-only lookups (no creator_id) ───────────────────── */

  it("returns market rate for a given tier without creator_id", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([]); // no past deals
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { tier: "mid" },
      execOpts
    )) as {
      tier: string;
      content_format: string;
      market_rate: { min: number; max: number; median: number; currency: string };
      creator_specific: null;
      brand_historical: { avg_rate_paid: null; total_past_deals: number; note: string };
    };

    expect(result.tier).toBe("mid");
    expect(result.content_format).toBe("any");
    // Mid-tier: min 25000, max 75000, median 45000 (with adjustment 1.0)
    expect(result.market_rate.min).toBe(25000);
    expect(result.market_rate.max).toBe(75000);
    expect(result.market_rate.median).toBe(45000);
    expect(result.market_rate.currency).toBe("INR");
    expect(result.creator_specific).toBeNull();
    expect(result.brand_historical.avg_rate_paid).toBeNull();
    expect(result.brand_historical.total_past_deals).toBe(0);
    expect(result.brand_historical.note).toContain("No past mid-tier deals");
  });

  it("defaults to micro tier when no tier provided", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute({}, execOpts)) as {
      tier: string;
      market_rate: { min: number; max: number; median: number };
    };

    expect(result.tier).toBe("micro");
    // Micro base: min 8000, max 25000, median 15000
    expect(result.market_rate.min).toBe(8000);
    expect(result.market_rate.max).toBe(25000);
    expect(result.market_rate.median).toBe(15000);
  });

  it("returns correct rates for nano tier", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute({ tier: "nano" }, execOpts)) as {
      tier: string;
      market_rate: { min: number; max: number; median: number };
    };

    expect(result.tier).toBe("nano");
    expect(result.market_rate.min).toBe(2000);
    expect(result.market_rate.max).toBe(8000);
    expect(result.market_rate.median).toBe(5000);
  });

  it("returns correct rates for macro tier", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute({ tier: "macro" }, execOpts)) as {
      tier: string;
      market_rate: { min: number; max: number; median: number };
    };

    expect(result.tier).toBe("macro");
    expect(result.market_rate.min).toBe(75000);
    expect(result.market_rate.max).toBe(300000);
    expect(result.market_rate.median).toBe(150000);
  });

  it("returns correct rates for mega tier", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute({ tier: "mega" }, execOpts)) as {
      tier: string;
      market_rate: { min: number; max: number; median: number };
    };

    expect(result.tier).toBe("mega");
    expect(result.market_rate.min).toBe(300000);
    expect(result.market_rate.max).toBe(1500000);
    expect(result.market_rate.median).toBe(500000);
  });

  /* ── Content format multipliers ──────────────────────────── */

  it("applies reels multiplier (1.15x)", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { tier: "micro", content_format: "reels" },
      execOpts
    )) as {
      content_format: string;
      market_rate: { min: number; max: number; median: number };
    };

    expect(result.content_format).toBe("reels");
    // Micro: 8000, 25000, 15000 * 1.15
    expect(result.market_rate.min).toBe(Math.round(8000 * 1.15));
    expect(result.market_rate.max).toBe(Math.round(25000 * 1.15));
    expect(result.market_rate.median).toBe(Math.round(15000 * 1.15));
  });

  it("applies carousel multiplier (0.9x)", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { tier: "micro", content_format: "carousel" },
      execOpts
    )) as {
      market_rate: { min: number; max: number; median: number };
    };

    expect(result.market_rate.min).toBe(Math.round(8000 * 0.9));
    expect(result.market_rate.max).toBe(Math.round(25000 * 0.9));
    expect(result.market_rate.median).toBe(Math.round(15000 * 0.9));
  });

  it("applies static multiplier (0.75x)", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { tier: "micro", content_format: "static" },
      execOpts
    )) as {
      market_rate: { min: number; max: number; median: number };
    };

    expect(result.market_rate.min).toBe(Math.round(8000 * 0.75));
    expect(result.market_rate.max).toBe(Math.round(25000 * 0.75));
    expect(result.market_rate.median).toBe(Math.round(15000 * 0.75));
  });

  it("uses 1.0x multiplier for stories (no special format)", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { tier: "micro", content_format: "stories" },
      execOpts
    )) as {
      market_rate: { min: number; max: number; median: number };
    };

    // Stories doesn't match any special case -> 1.0x
    expect(result.market_rate.min).toBe(8000);
    expect(result.market_rate.max).toBe(25000);
    expect(result.market_rate.median).toBe(15000);
  });

  /* ── Creator-specific with CPI adjustments ───────────────── */

  it("applies +20% premium for high CPI (>= 80)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              handle: "@top_creator",
              tier: "mid",
              followers: 50000,
              cpi: 85,
              avg_engagement_rate: 5.0,
              primary_niche: "beauty",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as {
      tier: string;
      market_rate: { min: number; max: number; median: number };
      creator_specific: {
        handle: string;
        cpi: number;
        engagement_rate: number;
        niche: string;
        cpi_adjustment: string;
      };
    };

    expect(result.tier).toBe("mid");
    // Mid base * 1.2 CPI adjustment
    expect(result.market_rate.min).toBe(Math.round(25000 * 1.2));
    expect(result.market_rate.max).toBe(Math.round(75000 * 1.2));
    expect(result.market_rate.median).toBe(Math.round(45000 * 1.2));

    expect(result.creator_specific).not.toBeNull();
    expect(result.creator_specific.handle).toBe("@top_creator");
    expect(result.creator_specific.cpi).toBe(85);
    expect(result.creator_specific.engagement_rate).toBe(5.0);
    expect(result.creator_specific.niche).toBe("beauty");
    expect(result.creator_specific.cpi_adjustment).toContain("+20% premium");
    expect(result.creator_specific.cpi_adjustment).toContain("high CPI");
  });

  it("applies 0% adjustment for medium CPI (60-79)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              handle: "@mid_creator",
              tier: "micro",
              followers: 20000,
              cpi: 65,
              avg_engagement_rate: 3.5,
              primary_niche: "fashion",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as {
      market_rate: { min: number; max: number; median: number };
      creator_specific: { cpi_adjustment: string };
    };

    // Micro base * 1.0 (no adjustment)
    expect(result.market_rate.min).toBe(8000);
    expect(result.market_rate.max).toBe(25000);
    expect(result.market_rate.median).toBe(15000);
    expect(result.creator_specific.cpi_adjustment).toBe("market rate");
  });

  it("applies -15% discount for low CPI (< 60)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              handle: "@low_creator",
              tier: "mid",
              followers: 40000,
              cpi: 45,
              avg_engagement_rate: 2.0,
              primary_niche: "lifestyle",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as {
      market_rate: { min: number; max: number; median: number };
      creator_specific: { cpi_adjustment: string };
    };

    // Mid base * 0.85 discount
    expect(result.market_rate.min).toBe(Math.round(25000 * 0.85));
    expect(result.market_rate.max).toBe(Math.round(75000 * 0.85));
    expect(result.market_rate.median).toBe(Math.round(45000 * 0.85));
    expect(result.creator_specific.cpi_adjustment).toContain("15% discount");
    expect(result.creator_specific.cpi_adjustment).toContain("lower CPI");
  });

  it("combines CPI adjustment with format multiplier", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              handle: "@combo_creator",
              tier: "mid",
              followers: 50000,
              cpi: 85,
              avg_engagement_rate: 5.0,
              primary_niche: "beauty",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1", content_format: "reels" },
      execOpts
    )) as {
      market_rate: { min: number; max: number; median: number };
    };

    // Mid base * 1.2 (high CPI) * 1.15 (reels) = 1.38
    const combined = 1.2 * 1.15;
    expect(result.market_rate.min).toBe(Math.round(25000 * combined));
    expect(result.market_rate.max).toBe(Math.round(75000 * combined));
    expect(result.market_rate.median).toBe(Math.round(45000 * combined));
  });

  /* ── Creator not found ───────────────────────────────────── */

  it("falls back to param tier when creator not found", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([]); // not found
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "nonexistent", tier: "macro" },
      execOpts
    )) as {
      tier: string;
      creator_specific: null;
      market_rate: { min: number; max: number; median: number };
    };

    // Falls back to param tier "macro"
    expect(result.tier).toBe("macro");
    expect(result.creator_specific).toBeNull();
    expect(result.market_rate.min).toBe(75000);
  });

  it("falls back to micro when creator not found and no tier param", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "nonexistent" },
      execOpts
    )) as { tier: string };

    expect(result.tier).toBe("micro");
  });

  /* ── Brand historical rates ──────────────────────────────── */

  it("computes average historical rate from past deals", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { agreed_rate: 40000, creator_id: "c1", creators: { tier: "mid" }, campaigns: { brand_id: "brand-1" } },
            { agreed_rate: 50000, creator_id: "c2", creators: { tier: "mid" }, campaigns: { brand_id: "brand-1" } },
            { agreed_rate: 60000, creator_id: "c3", creators: { tier: "mid" }, campaigns: { brand_id: "brand-1" } },
            // Different tier — should be excluded from mid avg
            { agreed_rate: 10000, creator_id: "c4", creators: { tier: "nano" }, campaigns: { brand_id: "brand-1" } },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { tier: "mid" },
      execOpts
    )) as {
      brand_historical: {
        avg_rate_paid: number;
        total_past_deals: number;
        note: string;
      };
    };

    // avg of 40000, 50000, 60000 = 50000
    expect(result.brand_historical.avg_rate_paid).toBe(50000);
    expect(result.brand_historical.total_past_deals).toBe(3);
    expect(result.brand_historical.note).toContain("50,000");
    expect(result.brand_historical.note).toContain("mid-tier");
  });

  it("returns null avg_rate_paid when no past deals for tier", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            // Only nano deals, no mid deals
            { agreed_rate: 5000, creator_id: "c1", creators: { tier: "nano" }, campaigns: { brand_id: "brand-1" } },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { tier: "mid" },
      execOpts
    )) as {
      brand_historical: { avg_rate_paid: null; total_past_deals: number; note: string };
    };

    expect(result.brand_historical.avg_rate_paid).toBeNull();
    expect(result.brand_historical.total_past_deals).toBe(0);
    expect(result.brand_historical.note).toContain("No past mid-tier deals");
  });

  it("handles null campaign_creators data", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder(null); // null data
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { tier: "micro" },
      execOpts
    )) as {
      brand_historical: { avg_rate_paid: null; total_past_deals: number };
    };

    expect(result.brand_historical.avg_rate_paid).toBeNull();
    expect(result.brand_historical.total_past_deals).toBe(0);
  });

  /* ── CPI boundary values ─────────────────────────────────── */

  it("applies premium at exactly CPI 80 (boundary)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              handle: "@boundary",
              tier: "micro",
              followers: 15000,
              cpi: 80,
              avg_engagement_rate: 4.0,
              primary_niche: "tech",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as {
      creator_specific: { cpi_adjustment: string };
      market_rate: { median: number };
    };

    expect(result.creator_specific.cpi_adjustment).toContain("+20% premium");
    expect(result.market_rate.median).toBe(Math.round(15000 * 1.2));
  });

  it("applies market rate at exactly CPI 60 (boundary)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              handle: "@boundary60",
              tier: "micro",
              followers: 15000,
              cpi: 60,
              avg_engagement_rate: 3.0,
              primary_niche: "tech",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as {
      creator_specific: { cpi_adjustment: string };
      market_rate: { median: number };
    };

    expect(result.creator_specific.cpi_adjustment).toBe("market rate");
    expect(result.market_rate.median).toBe(15000);
  });

  it("applies discount at CPI 59 (just below boundary)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              handle: "@boundary59",
              tier: "micro",
              followers: 15000,
              cpi: 59,
              avg_engagement_rate: 2.5,
              primary_niche: "tech",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as {
      creator_specific: { cpi_adjustment: string };
      market_rate: { median: number };
    };

    expect(result.creator_specific.cpi_adjustment).toContain("15% discount");
    expect(result.market_rate.median).toBe(Math.round(15000 * 0.85));
  });

  /* ── Creator overrides param tier ────────────────────────── */

  it("uses creator tier over param tier when creator found", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              handle: "@macro_star",
              tier: "macro",
              followers: 200000,
              cpi: 70,
              avg_engagement_rate: 2.5,
              primary_niche: "entertainment",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1", tier: "nano" }, // param says nano, creator is macro
      execOpts
    )) as { tier: string; market_rate: { min: number } };

    expect(result.tier).toBe("macro"); // creator tier wins
    expect(result.market_rate.min).toBe(75000); // macro rates
  });

  /* ── No CPI data ─────────────────────────────────────────── */

  it("applies no CPI adjustment when creator has no CPI", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              handle: "@no_cpi",
              tier: "micro",
              followers: 12000,
              cpi: null,
              avg_engagement_rate: 3.0,
              primary_niche: "food",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = rateBenchmarkerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as {
      market_rate: { min: number; max: number; median: number };
    };

    // No CPI adjustment → 1.0x
    expect(result.market_rate.min).toBe(8000);
    expect(result.market_rate.max).toBe(25000);
    expect(result.market_rate.median).toBe(15000);
  });
});

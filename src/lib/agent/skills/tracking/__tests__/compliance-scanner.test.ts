import { describe, it, expect, vi } from "vitest";
import { complianceScannerTool } from "../compliance-scanner";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit", "insert", "update",
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

type SupabaseParam = Parameters<typeof complianceScannerTool>[1];
const execOpts = { toolCallId: "tc", messages: [], abortSignal: undefined as never };

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("compliance-scanner", () => {
  const brandId = "brand-1";

  it("returns error when submission not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = complianceScannerTool(brandId, supabase);
    const result = await t.execute(
      { submission_id: "missing" },
      execOpts
    );
    expect(result).toHaveProperty("error", "Submission not found");
  });

  it("passes compliant content", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "content_submissions") {
          return mockQueryBuilder([
            {
              id: "sub-1",
              campaign_id: "camp-1",
              creator_id: "c1",
              campaign_creator_id: "cc1",
              caption_text:
                "Loving the new GlowUp serum! Use code SKIN15 for 15% off. #ad @glowup",
              content_url: "https://instagram.com/p/123",
              status: "submitted",
            },
          ]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([
            {
              id: "camp-1",
              name: "Summer Campaign",
              brand_id: "brand-1",
              discount_percent: 15,
              brief_requirements: [],
            },
          ]);
        }
        if (table === "brands") {
          return mockQueryBuilder([
            { brand_name: "GlowUp", instagram_handle: "@glowup" },
          ]);
        }
        if (table === "campaign_discount_codes") {
          return mockQueryBuilder([{ code: "SKIN15" }]);
        }
        // compliance_scans insert + content_submissions update
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = complianceScannerTool(brandId, supabase);
    const result = (await t.execute(
      { submission_id: "sub-1" },
      execOpts
    )) as {
      overall_pass: boolean;
      checks: {
        ad_disclosure: boolean;
        brand_mention: boolean;
        discount_code: boolean;
      };
      issues: string[];
    };

    expect(result.overall_pass).toBe(true);
    expect(result.checks.ad_disclosure).toBe(true);
    expect(result.checks.brand_mention).toBe(true);
    expect(result.checks.discount_code).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("fails non-compliant content and generates revision draft", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "content_submissions") {
          return mockQueryBuilder([
            {
              id: "sub-2",
              campaign_id: "camp-1",
              creator_id: "c1",
              campaign_creator_id: "cc1",
              caption_text: "Check out this amazing product I love!",
              content_url: "https://instagram.com/p/456",
              status: "submitted",
            },
          ]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([
            {
              id: "camp-1",
              name: "Test",
              brand_id: "brand-1",
              discount_percent: 15,
              brief_requirements: ["Show unboxing"],
            },
          ]);
        }
        if (table === "brands") {
          return mockQueryBuilder([
            { brand_name: "GlowUp", instagram_handle: "@glowup" },
          ]);
        }
        if (table === "campaign_discount_codes") {
          return mockQueryBuilder([{ code: "GLOW15" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = complianceScannerTool(brandId, supabase);
    const result = (await t.execute(
      { submission_id: "sub-2" },
      execOpts
    )) as {
      overall_pass: boolean;
      issues: string[];
      revision_draft: string | null;
      checks: {
        ad_disclosure: boolean;
        brand_mention: boolean;
        discount_code: boolean;
        brief_requirements: { requirement: string; met: boolean }[];
      };
    };

    expect(result.overall_pass).toBe(false);
    expect(result.checks.ad_disclosure).toBe(false);
    expect(result.checks.brand_mention).toBe(false);
    expect(result.checks.discount_code).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.revision_draft).not.toBeNull();
    expect(result.revision_draft).toContain("ad disclosure");
    // Brief requirement "Show unboxing" — "unboxing" (>3 chars) should be checked
    expect(result.checks.brief_requirements[0].met).toBe(false);
  });

  it("detects various ad disclosure formats", async () => {
    const testCases = [
      { caption: "Great product! #sponsored", expected: true },
      { caption: "In partnership with brand #partner", expected: true },
      { caption: "This is a #paidpartnership", expected: true },
      { caption: "No disclosure here", expected: false },
    ];

    for (const tc of testCases) {
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "content_submissions") {
            return mockQueryBuilder([
              {
                id: "sub",
                campaign_id: "camp-1",
                creator_id: "c1",
                caption_text: tc.caption,
                status: "submitted",
              },
            ]);
          }
          if (table === "campaigns") {
            return mockQueryBuilder([
              { id: "camp-1", brand_id: "brand-1", brief_requirements: [] },
            ]);
          }
          if (table === "brands") {
            return mockQueryBuilder([{ brand_name: "Test" }]);
          }
          if (table === "campaign_discount_codes") {
            return mockQueryBuilder([]); // no code
          }
          return mockQueryBuilder([]);
        }),
      } as unknown as SupabaseParam;

      const t = complianceScannerTool(brandId, supabase);
      const result = (await t.execute(
        { submission_id: "sub" },
        execOpts
      )) as { checks: { ad_disclosure: boolean } };

      expect(result.checks.ad_disclosure).toBe(tc.expected);
    }
  });
});

import { describe, it, expect, vi } from "vitest";
import { contentAnalyzerTool } from "../content-analyzer";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit", "insert", "update", "delete",
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

type SupabaseParam = Parameters<typeof contentAnalyzerTool>[1];
const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

const BRAND_ID = "brand-1";

const SAMPLE_ANALYSIS = {
  hook_strength: { score: 78, assessment: "Good hook" },
  brand_mention: { score: 85, assessment: "Natural mention" },
  brief_compliance: { score: 90, requirements: [] },
  guideline_compliance: { score: 95, assessment: "Compliant" },
  language_tone: { score: 82, assessment: "Good tone" },
  content_depth: { score: 70, assessment: "Moderate depth" },
  cultural_signals: { score: 65, assessment: "Some signals" },
  cta_effectiveness: { score: 75, assessment: "Clear CTA" },
  production_quality: { score: 80, assessment: "Good quality" },
  overall: {
    score: 80,
    tier: "strong",
    summary: "Well-executed content",
    strengths: ["Natural brand integration"],
    improvement_areas: ["CTA could be stronger"],
    recommendation: "approve",
    confidence: 0.85,
  },
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("content-analyzer", () => {
  describe("analyze action", () => {
    it("returns completed analysis for a single submission", async () => {
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "content_analyses") {
            return mockQueryBuilder([
              {
                content_submission_id: "sub-1",
                brand_id: BRAND_ID,
                status: "completed",
                overall_score: 80,
                analysis: SAMPLE_ANALYSIS,
                transcript_text: "Hello everyone, today I want to show you...",
                detected_language: "en",
                hook_text: "Hello everyone",
                is_likely_music: false,
              },
            ]);
          }
          return mockQueryBuilder([]);
        }),
      } as unknown as SupabaseParam;

      const t = contentAnalyzerTool(BRAND_ID, supabase);
      const result = (await t.execute(
        { submission_id: "sub-1", action: "analyze" },
        execOpts
      )) as Record<string, unknown>;

      expect(result.status).toBe("completed");
      expect(result.overall_score).toBe(80);
      expect(result.analysis).toEqual(SAMPLE_ANALYSIS);
      expect(result.transcript).toBe(
        "Hello everyone, today I want to show you..."
      );
      expect(result.detected_language).toBe("en");
    });

    it("returns no_analysis when analysis not found", async () => {
      const supabase = {
        from: vi.fn(() => mockQueryBuilder([])),
      } as unknown as SupabaseParam;

      const t = contentAnalyzerTool(BRAND_ID, supabase);
      const result = (await t.execute(
        { submission_id: "missing", action: "analyze" },
        execOpts
      )) as Record<string, unknown>;

      expect(result.status).toBe("no_analysis");
    });

    it("returns access denied for wrong brand", async () => {
      const supabase = {
        from: vi.fn(() =>
          mockQueryBuilder([
            {
              content_submission_id: "sub-1",
              brand_id: "other-brand",
              status: "completed",
              overall_score: 80,
              analysis: SAMPLE_ANALYSIS,
            },
          ])
        ),
      } as unknown as SupabaseParam;

      const t = contentAnalyzerTool(BRAND_ID, supabase);
      const result = (await t.execute(
        { submission_id: "sub-1", action: "analyze" },
        execOpts
      )) as Record<string, unknown>;

      expect(result.error).toBe("Access denied");
    });

    it("reports in-progress analysis status", async () => {
      const supabase = {
        from: vi.fn(() =>
          mockQueryBuilder([
            {
              content_submission_id: "sub-1",
              brand_id: BRAND_ID,
              status: "transcribing",
              error_message: null,
            },
          ])
        ),
      } as unknown as SupabaseParam;

      const t = contentAnalyzerTool(BRAND_ID, supabase);
      const result = (await t.execute(
        { submission_id: "sub-1", action: "analyze" },
        execOpts
      )) as Record<string, unknown>;

      expect(result.status).toBe("transcribing");
      expect(result.message).toContain("transcribing");
    });
  });

  describe("compare action", () => {
    it("returns side-by-side comparison of campaign submissions", async () => {
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "campaigns") {
            return mockQueryBuilder([
              { id: "camp-1", name: "Summer Campaign" },
            ]);
          }
          if (table === "content_analyses") {
            return mockQueryBuilder([
              {
                content_submission_id: "sub-1",
                creator_id: "creator-a",
                status: "completed",
                overall_score: 85,
                hook_strength_score: 90,
                brand_mention_score: 80,
                brief_compliance_score: 95,
                guideline_compliance_score: 90,
                analysis: {
                  overall: {
                    recommendation: "approve",
                    summary: "Great content from creator A",
                  },
                },
              },
              {
                content_submission_id: "sub-2",
                creator_id: "creator-b",
                status: "completed",
                overall_score: 65,
                hook_strength_score: 50,
                brand_mention_score: 70,
                brief_compliance_score: 80,
                guideline_compliance_score: 60,
                analysis: {
                  overall: {
                    recommendation: "revision_requested",
                    summary: "Needs work from creator B",
                  },
                },
              },
            ]);
          }
          if (table === "creators") {
            return mockQueryBuilder([
              { id: "creator-a", handle: "creator_a" },
              { id: "creator-b", handle: "creator_b" },
            ]);
          }
          return mockQueryBuilder([]);
        }),
      } as unknown as SupabaseParam;

      const t = contentAnalyzerTool(BRAND_ID, supabase);
      const result = (await t.execute(
        { campaign_id: "camp-1", action: "compare" },
        execOpts
      )) as {
        campaign_name: string;
        submissions: Array<{
          creator: string;
          overall_score: number;
          recommendation: string;
        }>;
      };

      expect(result.campaign_name).toBe("Summer Campaign");
      expect(result.submissions).toHaveLength(2);
      expect(result.submissions[0].creator).toBe("creator_a");
      expect(result.submissions[0].overall_score).toBe(85);
      expect(result.submissions[1].creator).toBe("creator_b");
      expect(result.submissions[1].recommendation).toBe("revision_requested");
    });

    it("returns error for missing campaign_id", async () => {
      const supabase = {
        from: vi.fn(() => mockQueryBuilder([])),
      } as unknown as SupabaseParam;

      const t = contentAnalyzerTool(BRAND_ID, supabase);
      const result = (await t.execute(
        { action: "compare" },
        execOpts
      )) as Record<string, unknown>;

      expect(result.error).toContain("submission_id or campaign_id");
    });

    it("returns no_analyses when campaign has no completed analyses", async () => {
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "campaigns") {
            return mockQueryBuilder([{ id: "camp-1", name: "Empty Campaign" }]);
          }
          if (table === "content_analyses") {
            return mockQueryBuilder([]);
          }
          return mockQueryBuilder([]);
        }),
      } as unknown as SupabaseParam;

      const t = contentAnalyzerTool(BRAND_ID, supabase);
      const result = (await t.execute(
        { campaign_id: "camp-1", action: "compare" },
        execOpts
      )) as Record<string, unknown>;

      expect(result.status).toBe("no_analyses");
    });
  });

  describe("summarize action", () => {
    it("returns aggregate stats for a campaign", async () => {
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "campaigns") {
            return mockQueryBuilder([
              { id: "camp-1", name: "Summer Campaign" },
            ]);
          }
          if (table === "content_analyses") {
            return mockQueryBuilder([
              {
                content_submission_id: "sub-1",
                creator_id: "creator-a",
                status: "completed",
                overall_score: 90,
                analysis: {
                  overall: {
                    recommendation: "approve",
                    summary: "Excellent content",
                  },
                },
              },
              {
                content_submission_id: "sub-2",
                creator_id: "creator-b",
                status: "completed",
                overall_score: 70,
                analysis: {
                  overall: {
                    recommendation: "revision_requested",
                    summary: "Decent content",
                  },
                },
              },
              {
                content_submission_id: "sub-3",
                creator_id: "creator-c",
                status: "completed",
                overall_score: 80,
                analysis: {
                  overall: {
                    recommendation: "approve",
                    summary: "Good content",
                  },
                },
              },
            ]);
          }
          if (table === "creators") {
            return mockQueryBuilder([
              { id: "creator-a", handle: "top_creator" },
              { id: "creator-b", handle: "mid_creator" },
              { id: "creator-c", handle: "good_creator" },
            ]);
          }
          return mockQueryBuilder([]);
        }),
      } as unknown as SupabaseParam;

      const t = contentAnalyzerTool(BRAND_ID, supabase);
      const result = (await t.execute(
        { campaign_id: "camp-1", action: "summarize" },
        execOpts
      )) as {
        total_submissions: number;
        average_score: number;
        highest_score: number;
        lowest_score: number;
        recommendation_breakdown: Record<string, number>;
        top_submission: { creator: string; score: number };
      };

      expect(result.total_submissions).toBe(3);
      expect(result.average_score).toBe(80); // (90+70+80)/3
      expect(result.highest_score).toBe(90);
      expect(result.lowest_score).toBe(70);
      expect(result.recommendation_breakdown).toEqual({
        approve: 2,
        revision_requested: 1,
      });
      expect(result.top_submission.creator).toBe("top_creator");
      expect(result.top_submission.score).toBe(90);
    });
  });
});

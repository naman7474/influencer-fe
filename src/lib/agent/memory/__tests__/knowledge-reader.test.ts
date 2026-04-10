import { describe, it, expect, vi } from "vitest";
import {
  retrieveKnowledge,
  formatKnowledgeForPrompt,
  type KnowledgeItem,
} from "../knowledge-reader";

/* ------------------------------------------------------------------ */
/*  Mock Supabase                                                      */
/* ------------------------------------------------------------------ */

function createMockSupabase(options?: {
  rpcResult?: KnowledgeItem[];
  queryResult?: KnowledgeItem[];
}) {
  const rpcFn = vi.fn().mockResolvedValue({
    data: options?.rpcResult ?? [],
    error: null,
  });

  const fromChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: options?.queryResult ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };

  return {
    rpc: rpcFn,
    from: vi.fn().mockReturnValue(fromChain),
    _rpc: rpcFn,
  };
}

const sampleKnowledge: KnowledgeItem[] = [
  {
    id: "k1",
    knowledge_type: "rate_benchmark",
    fact: "Micro fitness creators median ₹12-18K per reel",
    confidence: 0.91,
    evidence_count: 12,
    created_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "k2",
    knowledge_type: "outreach_pattern",
    fact: "Tuesday-Thursday sends get 35% higher response rate",
    confidence: 0.68,
    evidence_count: 23,
    created_at: "2026-03-15T00:00:00Z",
  },
];

/* ------------------------------------------------------------------ */
/*  retrieveKnowledge tests                                            */
/* ------------------------------------------------------------------ */

describe("retrieveKnowledge", () => {
  it("uses keyword RPC search when user message has content", async () => {
    const mock = createMockSupabase({ rpcResult: sampleKnowledge });
    const result = await retrieveKnowledge(
      "brand-1",
      "What are the rates for micro fitness creators?",
      mock as unknown as Parameters<typeof retrieveKnowledge>[2]
    );

    expect(mock._rpc).toHaveBeenCalledWith(
      "fn_search_agent_knowledge_keyword",
      expect.objectContaining({
        p_brand_id: "brand-1",
        p_min_confidence: 0.4,
        p_limit: 5,
      })
    );
    expect(result).toEqual(sampleKnowledge);
  });

  it("falls back to high-confidence recent items on empty message", async () => {
    const mock = createMockSupabase({ queryResult: sampleKnowledge });
    const result = await retrieveKnowledge(
      "brand-1",
      "",
      mock as unknown as Parameters<typeof retrieveKnowledge>[2]
    );

    // Should query the table directly, not RPC
    expect(mock._rpc).not.toHaveBeenCalled();
    expect(mock.from).toHaveBeenCalledWith("agent_knowledge");
  });

  it("falls back when keyword search returns empty", async () => {
    const mock = createMockSupabase({
      rpcResult: [],
      queryResult: sampleKnowledge,
    });
    const result = await retrieveKnowledge(
      "brand-1",
      "what about rates for creators",
      mock as unknown as Parameters<typeof retrieveKnowledge>[2]
    );

    // RPC was called but returned empty, so fallback was used
    expect(mock._rpc).toHaveBeenCalled();
    expect(mock.from).toHaveBeenCalledWith("agent_knowledge");
  });

  it("respects custom limit and minConfidence", async () => {
    const mock = createMockSupabase({ rpcResult: sampleKnowledge });
    await retrieveKnowledge(
      "brand-1",
      "fitness creator rates",
      mock as unknown as Parameters<typeof retrieveKnowledge>[2],
      3,
      0.6
    );

    expect(mock._rpc).toHaveBeenCalledWith(
      "fn_search_agent_knowledge_keyword",
      expect.objectContaining({
        p_limit: 3,
        p_min_confidence: 0.6,
      })
    );
  });

  it("filters short words from keyword extraction", async () => {
    const mock = createMockSupabase({ rpcResult: sampleKnowledge });
    await retrieveKnowledge(
      "brand-1",
      "is it ok to do so",
      mock as unknown as Parameters<typeof retrieveKnowledge>[2]
    );

    // All words are <= 3 chars, so falls back to high-confidence
    expect(mock._rpc).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  formatKnowledgeForPrompt tests                                     */
/* ------------------------------------------------------------------ */

describe("formatKnowledgeForPrompt", () => {
  it("formats knowledge items with type and confidence", () => {
    const result = formatKnowledgeForPrompt(sampleKnowledge);

    expect(result).toContain("## Relevant Knowledge");
    expect(result).toContain("[rate_benchmark, 91% confidence]");
    expect(result).toContain("Micro fitness creators median");
    expect(result).toContain("[outreach_pattern, 68% confidence]");
    expect(result).toContain("Tuesday-Thursday");
  });

  it("returns empty string for no items", () => {
    expect(formatKnowledgeForPrompt([])).toBe("");
  });

  it("rounds confidence to nearest integer percent", () => {
    const items: KnowledgeItem[] = [
      {
        id: "k1",
        knowledge_type: "niche_insight",
        fact: "Test fact",
        confidence: 0.756,
        evidence_count: 5,
        created_at: "2026-04-01T00:00:00Z",
      },
    ];
    const result = formatKnowledgeForPrompt(items);
    expect(result).toContain("76% confidence");
  });
});

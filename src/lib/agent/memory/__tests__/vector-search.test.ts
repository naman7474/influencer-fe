import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchEpisodesByVector,
  searchKnowledgeByVector,
  buildSearchQuery,
} from "../vector-search";

/* ------------------------------------------------------------------ */
/*  Mock embeddings module                                             */
/* ------------------------------------------------------------------ */

vi.mock("../embeddings", () => ({
  generateEmbedding: vi.fn(),
}));

import { generateEmbedding } from "../embeddings";
const mockGenerateEmbedding = vi.mocked(generateEmbedding);

/* ------------------------------------------------------------------ */
/*  Mock Supabase — fully chainable builder                            */
/* ------------------------------------------------------------------ */

function chainable(resolvedValue: { data: unknown; error: unknown }): unknown {
  // Returns a proxy where every method call returns another chainable,
  // and awaiting resolves to the final value.
  const builder = (): unknown =>
    new Proxy(() => {}, {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve(resolvedValue);
        }
        // Return a function that returns another chainable proxy
        return () => builder();
      },
      apply() {
        return builder();
      },
    });
  return builder();
}

function createMockSupabase(options?: {
  rpcResults?: Map<string, { data: unknown; error: unknown }>;
  fromResult?: { data: unknown; error: unknown };
}) {
  const defaultFromResult = options?.fromResult ?? { data: [], error: null };

  const rpcFn = vi.fn().mockImplementation((fnName: string) => {
    if (options?.rpcResults?.has(fnName)) {
      return Promise.resolve(options.rpcResults.get(fnName));
    }
    return Promise.resolve({ data: [], error: null });
  });

  return {
    rpc: rpcFn,
    from: vi.fn().mockReturnValue(chainable(defaultFromResult)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  buildSearchQuery                                                   */
/* ------------------------------------------------------------------ */

describe("buildSearchQuery", () => {
  it("extracts meaningful keywords from user message", () => {
    const result = buildSearchQuery("How much should I pay a fitness creator for a reel?");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("fitness");
    expect(result).toContain("creator");
  });

  it("returns empty string for empty input", () => {
    expect(buildSearchQuery("")).toBe("");
  });

  it("filters common stop words", () => {
    const result = buildSearchQuery("what is the best way to find creators");
    expect(result).not.toContain("what");
    expect(result).not.toContain("the");
    // "best", "way", "find", "creators" should remain
    expect(result).toContain("best");
    expect(result).toContain("creators");
  });

  it("handles messages with only stop words", () => {
    const result = buildSearchQuery("the a an is");
    expect(result).toBe("");
  });

  it("limits to 6 keywords", () => {
    const result = buildSearchQuery(
      "find micro fitness creators from Delhi Mumbai Bangalore for protein bar campaign"
    );
    const words = result.split(" ");
    expect(words.length).toBeLessThanOrEqual(6);
  });
});

/* ------------------------------------------------------------------ */
/*  searchEpisodesByVector                                             */
/* ------------------------------------------------------------------ */

describe("searchEpisodesByVector", () => {
  it("uses vector search when embedding succeeds", async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3];
    mockGenerateEmbedding.mockResolvedValue(fakeEmbedding);

    const vectorResults = [
      {
        id: "ep-1",
        summary: "Searched for fitness creators",
        episode_type: "creator_search",
        created_at: "2026-04-01T00:00:00Z",
        similarity: 0.92,
      },
    ];

    const rpcResults = new Map();
    rpcResults.set("fn_search_episodes_by_embedding", { data: vectorResults, error: null });

    const mock = createMockSupabase({ rpcResults });

    const results = await searchEpisodesByVector(
      "brand-1",
      "find fitness creators",
      mock as never,
      5
    );

    expect(results).toHaveLength(1);
    expect(results[0].summary).toBe("Searched for fitness creators");
    expect(mock.rpc).toHaveBeenCalledWith(
      "fn_search_episodes_by_embedding",
      expect.objectContaining({
        p_brand_id: "brand-1",
        p_embedding: fakeEmbedding,
        p_limit: 5,
      })
    );
  });

  it("falls back to keyword search when embedding fails", async () => {
    mockGenerateEmbedding.mockResolvedValue(null);

    const keywordResults = [
      {
        id: "ep-2",
        summary: "keyword match episode",
        episode_type: "general_interaction",
        created_at: "2026-04-02T00:00:00Z",
      },
    ];

    const rpcResults = new Map();
    rpcResults.set("fn_search_agent_episodes_keyword", { data: keywordResults, error: null });

    const mock = createMockSupabase({ rpcResults });

    const results = await searchEpisodesByVector(
      "brand-1",
      "find fitness creators",
      mock as never,
      5
    );

    expect(results).toHaveLength(1);
    expect(mock.rpc).toHaveBeenCalledWith(
      "fn_search_agent_episodes_keyword",
      expect.any(Object)
    );
  });

  it("falls back to keyword search when vector RPC fails", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

    const rpcResults = new Map();
    rpcResults.set("fn_search_episodes_by_embedding", { data: null, error: { message: "fail" } });
    rpcResults.set("fn_search_agent_episodes_keyword", {
      data: [{ id: "ep-3", summary: "fallback", episode_type: "general_interaction", created_at: "2026-04-01" }],
      error: null,
    });

    const mock = createMockSupabase({ rpcResults });

    const results = await searchEpisodesByVector(
      "brand-1",
      "find fitness creators",
      mock as never,
      5
    );

    // Should have called vector first, then keyword
    expect(mock.rpc).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
  });

  it("returns recent episodes as final fallback", async () => {
    mockGenerateEmbedding.mockResolvedValue(null);

    const recentEpisodes = [
      { id: "ep-4", summary: "recent one", episode_type: "general_interaction", created_at: "2026-04-09" },
    ];

    // rpc returns nothing, from() returns recent episodes
    const mock = createMockSupabase({
      fromResult: { data: recentEpisodes, error: null },
    });

    const results = await searchEpisodesByVector(
      "brand-1",
      "hi", // All stop words → empty keywords
      mock as never,
      5
    );

    expect(results).toHaveLength(1);
    expect(results[0].summary).toBe("recent one");
  });
});

/* ------------------------------------------------------------------ */
/*  searchKnowledgeByVector                                            */
/* ------------------------------------------------------------------ */

describe("searchKnowledgeByVector", () => {
  it("uses vector search when embedding succeeds", async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3];
    mockGenerateEmbedding.mockResolvedValue(fakeEmbedding);

    const vectorResults = [
      {
        id: "k-1",
        knowledge_type: "rate_benchmark",
        fact: "Micro-tier fitness: ₹12-18K",
        confidence: 0.85,
        evidence_count: 5,
        created_at: "2026-04-01T00:00:00Z",
        similarity: 0.90,
      },
    ];

    const rpcResults = new Map();
    rpcResults.set("fn_search_knowledge_by_embedding", { data: vectorResults, error: null });

    const mock = createMockSupabase({ rpcResults });

    const results = await searchKnowledgeByVector(
      "brand-1",
      "how much for fitness creators",
      mock as never,
      5,
      0.4
    );

    expect(results).toHaveLength(1);
    expect(results[0].fact).toBe("Micro-tier fitness: ₹12-18K");
    expect(mock.rpc).toHaveBeenCalledWith(
      "fn_search_knowledge_by_embedding",
      expect.objectContaining({
        p_brand_id: "brand-1",
        p_embedding: fakeEmbedding,
        p_min_confidence: 0.4,
        p_limit: 5,
      })
    );
  });

  it("falls back to keyword search when embedding fails", async () => {
    mockGenerateEmbedding.mockResolvedValue(null);

    const keywordResults = [
      { id: "k-2", knowledge_type: "niche_insight", fact: "keyword fallback", confidence: 0.7, evidence_count: 3, created_at: "2026-04-01" },
    ];

    const rpcResults = new Map();
    rpcResults.set("fn_search_agent_knowledge_keyword", { data: keywordResults, error: null });

    const mock = createMockSupabase({ rpcResults });

    const results = await searchKnowledgeByVector(
      "brand-1",
      "fitness creator rates benchmark",
      mock as never
    );

    expect(results).toHaveLength(1);
    expect(mock.rpc).toHaveBeenCalledWith(
      "fn_search_agent_knowledge_keyword",
      expect.any(Object)
    );
  });

  it("returns high-confidence fallback when nothing matches", async () => {
    mockGenerateEmbedding.mockResolvedValue(null);

    const highConfItems = [
      { id: "k-3", knowledge_type: "brand_preference", fact: "prefers minimal aesthetic", confidence: 0.9, evidence_count: 4, created_at: "2026-03-01" },
    ];

    // Both rpc calls return nothing; from() returns high confidence items
    const mock = createMockSupabase({
      fromResult: { data: highConfItems, error: null },
    });

    const results = await searchKnowledgeByVector(
      "brand-1",
      "hi", // stop words only → empty keywords
      mock as never
    );

    expect(results).toHaveLength(1);
    expect(results[0].fact).toBe("prefers minimal aesthetic");
  });
});

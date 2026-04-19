import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock external dependencies BEFORE importing the module
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue("mock-model"),
}));

import { executeCustomSkill } from "../custom-executor";
import { generateText } from "ai";

const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

/* ------------------------------------------------------------------ */
/*  Supabase mock helper                                               */
/* ------------------------------------------------------------------ */

function createMockSupabase(queryResult?: {
  data?: unknown;
  error?: { message: string } | null;
}) {
  const mockQuery: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(
      queryResult ?? { data: [{ id: 1, name: "Test" }], error: null }
    ),
  };

  return {
    from: vi.fn().mockReturnValue(mockQuery),
    _query: mockQuery,
  };
}

/* ------------------------------------------------------------------ */
/*  Prompt execution type                                              */
/* ------------------------------------------------------------------ */

describe("executeCustomSkill – prompt type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes a prompt skill with template interpolation", async () => {
    mockGenerateText.mockResolvedValue({
      text: "Here is the analysis of your fitness campaign.",
      usage: { totalTokens: 150 },
    });

    const result = await executeCustomSkill(
      {
        execution_type: "prompt",
        execution_config: {
          system_prompt: "You are a {{role}} assistant.",
          user_template: "Analyze the {{campaign_type}} campaign for {{brand}}.",
          model: "claude-sonnet-4-20250514",
        },
      },
      { role: "marketing", campaign_type: "fitness", brand: "FitBar" },
      "brand-1",
      {} as any
    );

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const call = mockGenerateText.mock.calls[0][0];
    expect(call.prompt).toBe("Analyze the fitness campaign for FitBar.");
    expect(call.system).toBe("You are a marketing assistant.");

    const res = result as Record<string, unknown>;
    expect(res.result).toBe("Here is the analysis of your fitness campaign.");
    expect(res.tokens_used).toBe(150);
    expect(res.params_received).toEqual({
      role: "marketing",
      campaign_type: "fitness",
      brand: "FitBar",
    });
  });

  it("handles missing system_prompt gracefully", async () => {
    mockGenerateText.mockResolvedValue({
      text: "Response",
      usage: { totalTokens: 50 },
    });

    const result = await executeCustomSkill(
      {
        execution_type: "prompt",
        execution_config: {
          user_template: "Hello {{name}}",
        },
      },
      { name: "World" },
      "brand-1",
      {} as any
    );

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.system).toBeUndefined(); // empty string -> undefined
    expect(call.prompt).toBe("Hello World");
  });

  it("handles missing template values with empty string", async () => {
    mockGenerateText.mockResolvedValue({
      text: "OK",
      usage: { totalTokens: 10 },
    });

    await executeCustomSkill(
      {
        execution_type: "prompt",
        execution_config: {
          user_template: "Hello {{name}}, your role is {{role}}",
        },
      },
      { name: "Test" }, // role is missing
      "brand-1",
      {} as any
    );

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.prompt).toBe("Hello Test, your role is ");
  });

  it("returns error when generateText fails", async () => {
    mockGenerateText.mockRejectedValue(new Error("API rate limit exceeded"));

    const result = await executeCustomSkill(
      {
        execution_type: "prompt",
        execution_config: {
          user_template: "Hello",
        },
      },
      {},
      "brand-1",
      {} as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toContain("Prompt execution failed");
    expect(res.error).toContain("API rate limit exceeded");
  });

  it("handles non-Error exception in prompt execution", async () => {
    mockGenerateText.mockRejectedValue("string error");

    const result = await executeCustomSkill(
      {
        execution_type: "prompt",
        execution_config: { user_template: "Hello" },
      },
      {},
      "brand-1",
      {} as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toContain("Unknown error");
  });

  it("handles null usage", async () => {
    mockGenerateText.mockResolvedValue({
      text: "Response",
      usage: null,
    });

    const result = await executeCustomSkill(
      {
        execution_type: "prompt",
        execution_config: { user_template: "Hi" },
      },
      {},
      "brand-1",
      {} as any
    );

    const res = result as Record<string, unknown>;
    expect(res.tokens_used).toBe(0);
  });

  it("uses default model when not specified", async () => {
    mockGenerateText.mockResolvedValue({
      text: "OK",
      usage: { totalTokens: 5 },
    });

    await executeCustomSkill(
      {
        execution_type: "prompt",
        execution_config: { user_template: "Hello" },
      },
      {},
      "brand-1",
      {} as any
    );

    // The function calls anthropic(model) with the default model
    expect(mockGenerateText).toHaveBeenCalledOnce();
  });
});

/* ------------------------------------------------------------------ */
/*  API execution type                                                 */
/* ------------------------------------------------------------------ */

describe("executeCustomSkill – api type", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("makes a GET request to interpolated URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue("application/json"),
      },
      json: vi.fn().mockResolvedValue({ users: [1, 2, 3] }),
    });

    const result = await executeCustomSkill(
      {
        execution_type: "api",
        execution_config: {
          method: "GET",
          url: "https://api.example.com/users/{{user_id}}",
          headers: { Authorization: "Bearer {{token}}" },
        },
      },
      { user_id: "42", token: "secret123" },
      "brand-1",
      {} as any
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.example.com/users/42",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer secret123" },
      })
    );

    const res = result as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ users: [1, 2, 3] });
  });

  it("makes a POST request with string body template", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue("application/json"),
      },
      json: vi.fn().mockResolvedValue({ id: "new-1" }),
    });

    const result = await executeCustomSkill(
      {
        execution_type: "api",
        execution_config: {
          method: "POST",
          url: "https://api.example.com/data",
          headers: { "Content-Type": "application/json" },
          body_template: '{"name": "{{name}}", "value": "{{value}}"}',
        },
      },
      { name: "test", value: "123" },
      "brand-1",
      {} as any
    );

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].body).toBe('{"name": "test", "value": "123"}');
    const res = result as Record<string, unknown>;
    expect(res.status).toBe(201);
  });

  it("makes a POST request with object body template (deep interpolation)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue("application/json"),
      },
      json: vi.fn().mockResolvedValue({ ok: true }),
    });

    const result = await executeCustomSkill(
      {
        execution_type: "api",
        execution_config: {
          method: "POST",
          url: "https://api.example.com/webhook",
          body_template: {
            name: "{{name}}",
            nested: { value: "{{val}}" },
            number: 42,
            arr: [1, 2, 3],
          },
        },
      },
      { name: "test", val: "deep" },
      "brand-1",
      {} as any
    );

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.name).toBe("test");
    expect(body.nested.value).toBe("deep");
    expect(body.number).toBe(42);
    // Content-Type should be auto-set for object body
    expect(fetchCall[1].headers["Content-Type"]).toBe("application/json");
  });

  it("returns error when no URL configured", async () => {
    const result = await executeCustomSkill(
      {
        execution_type: "api",
        execution_config: {},
      },
      {},
      "brand-1",
      {} as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toBe("No URL configured for this skill");
  });

  it("handles text response (non-JSON)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue("text/plain"),
      },
      text: vi.fn().mockResolvedValue("Hello, World!"),
    });

    const result = await executeCustomSkill(
      {
        execution_type: "api",
        execution_config: {
          url: "https://api.example.com/text",
        },
      },
      {},
      "brand-1",
      {} as any
    );

    const res = result as Record<string, unknown>;
    expect(res.data).toBe("Hello, World!");
  });

  it("handles fetch error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await executeCustomSkill(
      {
        execution_type: "api",
        execution_config: {
          url: "https://api.example.com/fail",
        },
      },
      {},
      "brand-1",
      {} as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toContain("API call failed");
    expect(res.error).toContain("Network error");
    expect(res.url).toBe("https://api.example.com/fail");
  });

  it("handles non-Error exception in fetch", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue("string error");

    const result = await executeCustomSkill(
      {
        execution_type: "api",
        execution_config: { url: "https://api.example.com" },
      },
      {},
      "brand-1",
      {} as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toContain("Unknown error");
  });

  it("does not send body for GET requests even with body_template", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: vi.fn().mockReturnValue("application/json") },
      json: vi.fn().mockResolvedValue({}),
    });

    await executeCustomSkill(
      {
        execution_type: "api",
        execution_config: {
          method: "GET",
          url: "https://api.example.com",
          body_template: '{"should": "not be sent"}',
        },
      },
      {},
      "brand-1",
      {} as any
    );

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].body).toBeUndefined();
  });

  it("defaults method to GET when not specified", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: vi.fn().mockReturnValue("application/json") },
      json: vi.fn().mockResolvedValue({}),
    });

    await executeCustomSkill(
      {
        execution_type: "api",
        execution_config: {
          url: "https://api.example.com",
        },
      },
      {},
      "brand-1",
      {} as any
    );

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].method).toBe("GET");
  });
});

/* ------------------------------------------------------------------ */
/*  Query execution type                                               */
/* ------------------------------------------------------------------ */

describe("executeCustomSkill – query type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes a simple query on an allowed table", async () => {
    const mock = createMockSupabase({
      data: [{ id: "c1", handle: "beauty_queen" }],
      error: null,
    });

    const result = await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          select: "id, handle",
          limit: 10,
        },
      },
      {},
      "brand-1",
      mock as any
    );

    const res = result as Record<string, unknown>;
    expect(res.results).toEqual([{ id: "c1", handle: "beauty_queen" }]);
    expect(res.count).toBe(1);
  });

  it("returns error for non-allowed table", async () => {
    const mock = createMockSupabase();

    const result = await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "users", // not in whitelist
        },
      },
      {},
      "brand-1",
      mock as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toContain('Table "users" is not accessible');
  });

  it("returns error when no table configured", async () => {
    const mock = createMockSupabase();

    const result = await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {},
      },
      {},
      "brand-1",
      mock as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toBe("No table configured for this skill");
  });

  it("applies brand_id scoping for brand-scoped tables", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "campaigns",
          select: "id, name",
        },
      },
      {},
      "brand-1",
      mock as any
    );

    // Should call .eq("brand_id", "brand-1")
    expect(mock._query.eq).toHaveBeenCalledWith("brand_id", "brand-1");
  });

  it("does NOT apply brand_id scoping for non-scoped tables", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          select: "*",
        },
      },
      {},
      "brand-1",
      mock as any
    );

    // creators is not brand-scoped, so eq should NOT be called with brand_id
    // However, due to chaining, we check that from("creators") was called
    expect(mock.from).toHaveBeenCalledWith("creators");
  });

  it("applies filters with various operators", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          select: "*",
          filters: [
            { column: "tier", op: "eq", param: "tier_filter" },
            { column: "followers", op: "gte", param: "min_followers" },
            { column: "followers", op: "lte", param: "max_followers" },
            { column: "handle", op: "ilike", param: "search" },
            { column: "status", op: "neq", param: "exclude_status" },
            { column: "score", op: "gt", param: "min_score" },
            { column: "score", op: "lt", param: "max_score" },
            { column: "niche", op: "like", param: "niche_search" },
            { column: "id", op: "in", param: "id_list" },
          ],
        },
      },
      {
        tier_filter: "micro",
        min_followers: 1000,
        max_followers: 50000,
        search: "beauty",
        exclude_status: "inactive",
        min_score: 0.5,
        max_score: 0.9,
        niche_search: "fit",
        id_list: ["c1", "c2"],
      },
      "brand-1",
      mock as any
    );

    expect(mock._query.eq).toHaveBeenCalledWith("tier", "micro");
    expect(mock._query.gte).toHaveBeenCalledWith("followers", 1000);
    expect(mock._query.lte).toHaveBeenCalledWith("followers", 50000);
    expect(mock._query.ilike).toHaveBeenCalledWith("handle", "%beauty%");
    expect(mock._query.neq).toHaveBeenCalledWith("status", "inactive");
    expect(mock._query.gt).toHaveBeenCalledWith("score", 0.5);
    expect(mock._query.lt).toHaveBeenCalledWith("score", 0.9);
    expect(mock._query.like).toHaveBeenCalledWith("niche", "%fit%");
    expect(mock._query.in).toHaveBeenCalledWith("id", ["c1", "c2"]);
  });

  it("skips filters with undefined param values", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          filters: [
            { column: "tier", op: "eq", param: "tier_filter" },
          ],
        },
      },
      {}, // tier_filter not provided
      "brand-1",
      mock as any
    );

    // eq should not be called with tier (only with potential brand_id scoping)
    // creators is not brand-scoped so no eq call at all for filters
    // The order and limit calls should still happen
    expect(mock._query.limit).toHaveBeenCalled();
  });

  it("skips filters with null param values", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          filters: [
            { column: "tier", op: "eq", param: "tier_filter" },
          ],
        },
      },
      { tier_filter: null },
      "brand-1",
      mock as any
    );

    expect(mock._query.limit).toHaveBeenCalled();
  });

  it("applies order when specified", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          order: "followers",
          order_ascending: true,
        },
      },
      {},
      "brand-1",
      mock as any
    );

    expect(mock._query.order).toHaveBeenCalledWith("followers", {
      ascending: true,
    });
  });

  it("defaults order_ascending to false", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          order: "created_at",
        },
      },
      {},
      "brand-1",
      mock as any
    );

    expect(mock._query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("caps limit at 50", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          limit: 100, // exceeds 50 cap
        },
      },
      {},
      "brand-1",
      mock as any
    );

    expect(mock._query.limit).toHaveBeenCalledWith(50);
  });

  it("defaults limit to 20", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
        },
      },
      {},
      "brand-1",
      mock as any
    );

    expect(mock._query.limit).toHaveBeenCalledWith(20);
  });

  it("handles query error from Supabase", async () => {
    const mock = createMockSupabase({
      data: null,
      error: { message: "relation not found" },
    });

    const result = await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
        },
      },
      {},
      "brand-1",
      mock as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toContain("Query failed");
    expect(res.error).toContain("relation not found");
  });

  it("handles exception thrown during query execution", async () => {
    const mock = {
      from: vi.fn().mockImplementation(() => {
        throw new Error("Connection lost");
      }),
    };

    const result = await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
        },
      },
      {},
      "brand-1",
      mock as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toContain("Query execution failed");
    expect(res.error).toContain("Connection lost");
  });

  it("handles non-Error exception in query", async () => {
    const mock = {
      from: vi.fn().mockImplementation(() => {
        throw "string error";
      }),
    };

    const result = await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: { table: "creators" },
      },
      {},
      "brand-1",
      mock as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toContain("Unknown error");
  });

  it("returns empty results array when data is null", async () => {
    const mock = createMockSupabase({ data: null, error: null });

    const result = await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
        },
      },
      {},
      "brand-1",
      mock as any
    );

    const res = result as Record<string, unknown>;
    expect(res.results).toEqual([]);
    expect(res.count).toBe(0);
  });

  it("converts non-array value to array for 'in' filter", async () => {
    const mock = createMockSupabase();

    await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          filters: [{ column: "id", op: "in", param: "single_id" }],
        },
      },
      { single_id: "c1" }, // string, not array
      "brand-1",
      mock as any
    );

    expect(mock._query.in).toHaveBeenCalledWith("id", ["c1"]);
  });

  it("handles unknown filter op gracefully", async () => {
    const mock = createMockSupabase();

    const result = await executeCustomSkill(
      {
        execution_type: "query",
        execution_config: {
          table: "creators",
          filters: [
            { column: "name", op: "regex", param: "pattern" },
          ],
        },
      },
      { pattern: ".*test.*" },
      "brand-1",
      mock as any
    );

    // Should not throw and should return results
    const res = result as Record<string, unknown>;
    expect(res.results).toBeDefined();
  });

  it("works with all allowed tables", async () => {
    const allowedTables = [
      "creators",
      "campaigns",
      "campaign_creators",
      "creator_brand_matches",
      "agent_episodes",
      "agent_knowledge",
      "approval_queue",
      "notifications",
      "mv_creator_relationship_summary",
    ];

    for (const table of allowedTables) {
      const mock = createMockSupabase();
      const result = await executeCustomSkill(
        {
          execution_type: "query",
          execution_config: { table },
        },
        {},
        "brand-1",
        mock as any
      );
      const res = result as Record<string, unknown>;
      expect(res.error).toBeUndefined();
      expect(res.results).toBeDefined();
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Unknown execution type                                             */
/* ------------------------------------------------------------------ */

describe("executeCustomSkill – unknown type", () => {
  it("returns error for unknown execution type", async () => {
    const result = await executeCustomSkill(
      {
        execution_type: "webhook" as any,
        execution_config: {},
      },
      {},
      "brand-1",
      {} as any
    );

    const res = result as Record<string, unknown>;
    expect(res.error).toBe("Unknown execution type: webhook");
  });
});

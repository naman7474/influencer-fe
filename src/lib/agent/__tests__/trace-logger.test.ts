import { describe, it, expect, vi, beforeEach } from "vitest";
import { TraceLogger, type TraceType } from "../trace-logger";

/* ------------------------------------------------------------------ */
/*  Mock Supabase                                                      */
/* ------------------------------------------------------------------ */

function createMockSupabase() {
  const insertFn = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    from: vi.fn().mockReturnValue({ insert: insertFn }),
    _insert: insertFn,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  TraceLogger                                                        */
/* ------------------------------------------------------------------ */

describe("TraceLogger", () => {
  it("creates a trace logger with brand and session context", () => {
    const mock = createMockSupabase();
    const logger = new TraceLogger("brand-1", "session-1", mock as never);
    expect(logger).toBeDefined();
  });

  it("logs a tool call trace", async () => {
    const mock = createMockSupabase();
    const logger = new TraceLogger("brand-1", "session-1", mock as never);

    await logger.logToolCall("creator_search", { query: "fitness" }, 150);

    expect(mock.from).toHaveBeenCalledWith("agent_traces");
    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        session_id: "session-1",
        trace_type: "tool_call",
        tool_name: "creator_search",
        input: { query: "fitness" },
        duration_ms: 150,
      })
    );
  });

  it("logs a tool result trace", async () => {
    const mock = createMockSupabase();
    const logger = new TraceLogger("brand-1", null, mock as never);

    await logger.logToolResult("creator_search", { count: 12 }, 200);

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        trace_type: "tool_result",
        tool_name: "creator_search",
        output: { count: 12 },
        duration_ms: 200,
      })
    );
  });

  it("logs a tool error trace", async () => {
    const mock = createMockSupabase();
    const logger = new TraceLogger("brand-1", null, mock as never);

    await logger.logToolError("discount_code_generator", "Shopify API timeout", 5000);

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        trace_type: "tool_error",
        tool_name: "discount_code_generator",
        error: "Shopify API timeout",
        duration_ms: 5000,
      })
    );
  });

  it("logs an LLM call trace with token count", async () => {
    const mock = createMockSupabase();
    const logger = new TraceLogger("brand-1", "session-1", mock as never);

    await logger.logLLMCall(1200, 350, 800);

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        trace_type: "llm_call",
        tokens_used: 1200,
        duration_ms: 350,
      })
    );
  });

  it("logs memory retrieval traces", async () => {
    const mock = createMockSupabase();
    const logger = new TraceLogger("brand-1", null, mock as never);

    await logger.logMemoryRetrieval("vector", 5, 120);

    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        trace_type: "memory_retrieval",
        output: { method: "vector", results_count: 5 },
        duration_ms: 120,
      })
    );
  });

  it("increments step number automatically", async () => {
    const mock = createMockSupabase();
    const logger = new TraceLogger("brand-1", null, mock as never);

    await logger.logToolCall("tool_a", {}, 100);
    await logger.logToolCall("tool_b", {}, 100);
    await logger.logToolCall("tool_c", {}, 100);

    const calls = mock._insert.mock.calls;
    expect(calls[0][0].step_number).toBe(1);
    expect(calls[1][0].step_number).toBe(2);
    expect(calls[2][0].step_number).toBe(3);
  });

  it("handles insert errors gracefully (no throw)", async () => {
    const mock = createMockSupabase();
    mock._insert.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const logger = new TraceLogger("brand-1", null, mock as never);

    // Should not throw
    await expect(
      logger.logToolCall("creator_search", {}, 100)
    ).resolves.not.toThrow();
  });

  it("computes cost estimate for LLM calls", async () => {
    const mock = createMockSupabase();
    const logger = new TraceLogger("brand-1", null, mock as never);

    await logger.logLLMCall(1000, 500, 200);

    const insertArg = mock._insert.mock.calls[0][0];
    // Should have a cost_cents field
    expect(insertArg.cost_cents).toBeDefined();
    expect(insertArg.cost_cents).toBeGreaterThan(0);
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  evaluateToolSelection,
  evaluateResponse,
  evaluateSemanticRelevance,
  runEvalSuite,
  type EvalCase,
  type EvalResult,
} from "../evaluator";

// Mock the AI SDK to avoid real LLM calls in tests
vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "8" }),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue("mock-model"),
}));

/* ------------------------------------------------------------------ */
/*  evaluateToolSelection                                              */
/* ------------------------------------------------------------------ */

describe("evaluateToolSelection", () => {
  it("scores 1.0 for exact match", () => {
    const score = evaluateToolSelection(
      ["creator_search"],
      ["creator_search"]
    );
    expect(score).toBe(1.0);
  });

  it("scores 1.0 when all expected tools are called (extras ok)", () => {
    const score = evaluateToolSelection(
      ["creator_search", "get_creator_details"],
      ["creator_search"]
    );
    // All expected tools were called
    expect(score).toBe(1.0);
  });

  it("scores 0.5 when half of expected tools are called", () => {
    const score = evaluateToolSelection(
      ["creator_search"],
      ["creator_search", "rate_benchmarker"]
    );
    expect(score).toBe(0.5);
  });

  it("scores 0 when no expected tools are called", () => {
    const score = evaluateToolSelection(
      ["get_creator_details"],
      ["creator_search"]
    );
    expect(score).toBe(0);
  });

  it("handles empty arrays", () => {
    expect(evaluateToolSelection([], [])).toBe(1.0);
    expect(evaluateToolSelection(["tool_a"], [])).toBe(1.0);
    expect(evaluateToolSelection([], ["tool_a"])).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  evaluateResponse                                                   */
/* ------------------------------------------------------------------ */

describe("evaluateResponse", () => {
  it("checks for required keywords in response", () => {
    const result = evaluateResponse(
      "I found 12 fitness creators in Delhi. @fit_priya has the highest CPI at 86.",
      ["fitness", "creators", "CPI"]
    );
    expect(result.score).toBe(1.0);
    expect(result.missingKeywords).toHaveLength(0);
  });

  it("reports missing keywords", () => {
    const result = evaluateResponse(
      "Here are some results.",
      ["fitness", "CPI", "Delhi"]
    );
    expect(result.score).toBeLessThan(1.0);
    expect(result.missingKeywords.length).toBeGreaterThan(0);
  });

  it("is case insensitive", () => {
    const result = evaluateResponse(
      "Found FITNESS creators with high CPI scores",
      ["fitness", "cpi"]
    );
    expect(result.score).toBe(1.0);
  });

  it("handles empty expected keywords", () => {
    const result = evaluateResponse("any response", []);
    expect(result.score).toBe(1.0);
  });
});

/* ------------------------------------------------------------------ */
/*  runEvalSuite                                                       */
/* ------------------------------------------------------------------ */

describe("runEvalSuite", () => {
  it("runs all evaluation cases and computes aggregate scores", async () => {
    const cases: EvalCase[] = [
      {
        name: "creator_search_basic",
        userMessage: "Find fitness creators in Delhi",
        expectedTools: ["creator_search"],
        expectedKeywords: ["fitness", "Delhi"],
        actualToolsCalled: ["creator_search"],
        actualResponse: "I found 8 fitness creators in Delhi.",
      },
      {
        name: "rate_benchmark",
        userMessage: "How much for a micro fitness reel?",
        expectedTools: ["rate_benchmarker"],
        expectedKeywords: ["rate", "micro"],
        actualToolsCalled: ["rate_benchmarker"],
        actualResponse: "The market rate for micro-tier fitness creators is ₹12-18K.",
      },
    ];

    const results = await runEvalSuite(cases);

    expect(results.cases).toHaveLength(2);
    expect(results.aggregateToolScore).toBe(1.0);
    expect(results.aggregateResponseScore).toBe(1.0);
    expect(results.passRate).toBe(1.0);
    // Without LLM judge, semantic scores should be null
    expect(results.aggregateSemanticScore).toBeNull();
  });

  it("reports failures accurately", async () => {
    const cases: EvalCase[] = [
      {
        name: "missing_tool",
        userMessage: "Find creators",
        expectedTools: ["creator_search"],
        expectedKeywords: ["creators"],
        actualToolsCalled: [], // Tool wasn't called!
        actualResponse: "I can help you find creators. What filters?",
      },
    ];

    const results = await runEvalSuite(cases);

    expect(results.cases[0].toolScore).toBe(0);
    expect(results.passRate).toBe(0);
  });

  it("computes partial scores correctly", async () => {
    const cases: EvalCase[] = [
      {
        name: "partial",
        userMessage: "Search and draft",
        expectedTools: ["creator_search", "outreach_drafter"],
        expectedKeywords: ["search", "outreach", "draft"],
        actualToolsCalled: ["creator_search"],
        actualResponse: "Found creators. I'll search for the best matches.",
      },
    ];

    const results = await runEvalSuite(cases);

    expect(results.aggregateToolScore).toBe(0.5); // 1 of 2 tools
    expect(results.aggregateResponseScore).toBeLessThan(1.0);
  });

  it("includes semantic scores when LLM judge is enabled", async () => {
    const cases: EvalCase[] = [
      {
        name: "with_llm_judge",
        userMessage: "Find fitness creators in Delhi",
        expectedTools: ["creator_search"],
        expectedKeywords: ["fitness"],
        actualToolsCalled: ["creator_search"],
        actualResponse: "I found 8 fitness creators in Delhi with high engagement.",
      },
    ];

    const results = await runEvalSuite(cases, { useLLMJudge: true });

    expect(results.cases[0].semanticScore).toBe(0.8); // Mock returns "8" → 8/10 = 0.8
    expect(results.aggregateSemanticScore).toBe(0.8);
  });
});

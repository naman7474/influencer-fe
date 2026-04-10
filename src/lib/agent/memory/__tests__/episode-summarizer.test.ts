import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateEpisodeSummary,
  classifyEpisodeType,
  computeImportance,
} from "../episode-summarizer";

/* ------------------------------------------------------------------ */
/*  Mock the AI SDK                                                    */
/* ------------------------------------------------------------------ */

const mockGenerateText = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => ({ modelId: "claude-haiku-4-5-20251001" })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  classifyEpisodeType                                                */
/* ------------------------------------------------------------------ */

describe("classifyEpisodeType", () => {
  it("classifies creator search messages", () => {
    expect(classifyEpisodeType("Find me fitness creators in Delhi")).toBe("creator_search");
    expect(classifyEpisodeType("search for micro influencers")).toBe("creator_search");
    expect(classifyEpisodeType("discover fashion creators")).toBe("creator_search");
    expect(classifyEpisodeType("recommend creators for my brand")).toBe("creator_search");
  });

  it("classifies outreach messages", () => {
    expect(classifyEpisodeType("draft an outreach email to Priya")).toBe("outreach_drafted");
    expect(classifyEpisodeType("write an email for the campaign")).toBe("outreach_drafted");
    expect(classifyEpisodeType("compose a message to the creator")).toBe("outreach_drafted");
  });

  it("classifies rate/pricing messages", () => {
    expect(classifyEpisodeType("how much should I pay for a reel")).toBe("rate_benchmark");
    expect(classifyEpisodeType("what's the market rate for micro creators")).toBe("rate_benchmark");
    expect(classifyEpisodeType("is ₹15K worth it for this creator")).toBe("rate_benchmark");
  });

  it("classifies campaign messages", () => {
    expect(classifyEpisodeType("how is my summer campaign performing")).toBe("campaign_advice");
    expect(classifyEpisodeType("show me ROI analytics")).toBe("campaign_advice");
    expect(classifyEpisodeType("campaign performance report")).toBe("campaign_advice");
  });

  it("classifies preference expressions", () => {
    expect(classifyEpisodeType("I don't like creators with busy aesthetics")).toBe("preference_learned");
    expect(classifyEpisodeType("we prefer clean minimal styles")).toBe("preference_learned");
    expect(classifyEpisodeType("always choose creators from tier 1 cities")).toBe("preference_learned");
  });

  it("classifies corrections", () => {
    expect(classifyEpisodeType("no that's wrong, the budget is 2L")).toBe("correction_received");
    expect(classifyEpisodeType("actually I meant something different")).toBe("correction_received");
  });

  it("defaults to general_interaction", () => {
    expect(classifyEpisodeType("hello")).toBe("general_interaction");
    expect(classifyEpisodeType("thanks")).toBe("general_interaction");
  });
});

/* ------------------------------------------------------------------ */
/*  computeImportance                                                  */
/* ------------------------------------------------------------------ */

describe("computeImportance", () => {
  it("assigns high importance to corrections", () => {
    expect(computeImportance("correction_received")).toBeGreaterThanOrEqual(0.8);
  });

  it("assigns high importance to preference learning", () => {
    expect(computeImportance("preference_learned")).toBeGreaterThanOrEqual(0.8);
  });

  it("assigns high importance to outreach rejections", () => {
    expect(computeImportance("outreach_rejected")).toBeGreaterThanOrEqual(0.8);
  });

  it("assigns medium importance to searches and benchmarks", () => {
    const searchImp = computeImportance("creator_search");
    expect(searchImp).toBeGreaterThanOrEqual(0.4);
    expect(searchImp).toBeLessThanOrEqual(0.7);
  });

  it("assigns low importance to general interactions", () => {
    expect(computeImportance("general_interaction")).toBeLessThanOrEqual(0.4);
  });

  it("assigns medium-high importance to outreach approvals", () => {
    expect(computeImportance("outreach_approved")).toBeGreaterThanOrEqual(0.6);
  });
});

/* ------------------------------------------------------------------ */
/*  generateEpisodeSummary                                             */
/* ------------------------------------------------------------------ */

describe("generateEpisodeSummary", () => {
  it("returns LLM-generated summary on success", async () => {
    mockGenerateText.mockResolvedValue({
      text: "User searched for fitness creators in Delhi. Agent found 12 matching creators and recommended top 5 based on CPI scores. User was particularly interested in @fit_priya (CPI: 86).",
    });

    const result = await generateEpisodeSummary(
      "Find me the best fitness creators in Delhi",
      "I found 12 fitness creators in Delhi. Here are the top 5 ranked by CPI score..."
    );

    expect(result).toContain("fitness creators");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("falls back to template summary on LLM failure", async () => {
    mockGenerateText.mockRejectedValue(new Error("LLM API error"));

    const result = await generateEpisodeSummary(
      "Find me fitness creators",
      "Here are the results..."
    );

    // Should return a template-based fallback, not throw
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back to template for very short inputs", async () => {
    const result = await generateEpisodeSummary("hi", "hello");

    // Should not waste an LLM call on trivial exchanges
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  it("truncates very long responses in the prompt", async () => {
    const longResponse = "x".repeat(5000);
    mockGenerateText.mockResolvedValue({
      text: "Summary of a long conversation.",
    });

    await generateEpisodeSummary("question", longResponse);

    const callArgs = mockGenerateText.mock.calls[0][0] as { prompt: string };
    // The prompt should be reasonable length, not include the full 5000 chars
    expect(callArgs.prompt.length).toBeLessThan(3000);
  });
});

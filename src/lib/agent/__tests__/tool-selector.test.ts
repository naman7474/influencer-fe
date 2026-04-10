import { describe, it, expect } from "vitest";
import { selectRelevantTools } from "../tool-selector";

/* ------------------------------------------------------------------ */
/*  Mock tools — simple objects to simulate Vercel AI SDK tools        */
/* ------------------------------------------------------------------ */

function makeMockTools(): Record<string, unknown> {
  const names = [
    "creator_search",
    "get_creator_details",
    "get_campaign_info",
    "workflow_executor",
    "lookalike_finder",
    "competitor_mapper",
    "audience_overlap_check",
    "geo_opportunity_finder",
    "warm_lead_detector",
    "outreach_drafter",
    "propose_outreach",
    "rate_benchmarker",
    "counter_offer_generator",
    "budget_optimizer",
    "deal_memo_generator",
    "campaign_builder",
    "discount_code_generator",
    "utm_generator",
    "brief_generator",
    "gifting_order_creator",
    "roi_calculator",
    "campaign_reporter",
    "relationship_scorer",
    "reengagement_recommender",
    "ambassador_identifier",
    "churn_predictor",
    "compliance_scanner",
    "campaign_status_manager",
  ];

  const tools: Record<string, unknown> = {};
  for (const name of names) {
    tools[name] = { description: name, execute: () => {} };
  }
  return tools;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("selectRelevantTools", () => {
  it("always includes core tools regardless of message", () => {
    const allTools = makeMockTools() as Record<string, never>;
    const selected = selectRelevantTools(allTools, "What's the ROI?");

    expect(selected).toHaveProperty("creator_search");
    expect(selected).toHaveProperty("get_creator_details");
    expect(selected).toHaveProperty("get_campaign_info");
    expect(selected).toHaveProperty("workflow_executor");
  });

  it("selects discovery tools for creator search messages", () => {
    const allTools = makeMockTools() as Record<string, never>;
    const selected = selectRelevantTools(allTools, "Find fitness creators in Mumbai");

    expect(selected).toHaveProperty("creator_search");
    expect(selected).toHaveProperty("lookalike_finder");
  });

  it("selects negotiation tools for rate-related messages", () => {
    const allTools = makeMockTools() as Record<string, never>;
    const selected = selectRelevantTools(allTools, "What's the market rate for micro creators?");

    expect(selected).toHaveProperty("rate_benchmarker");
  });

  it("selects outreach tools for outreach messages", () => {
    const allTools = makeMockTools() as Record<string, never>;
    const selected = selectRelevantTools(allTools, "Draft an outreach email to the creator");

    expect(selected).toHaveProperty("outreach_drafter");
  });

  it("returns all tools when message is empty", () => {
    const allTools = makeMockTools() as Record<string, never>;
    const selected = selectRelevantTools(allTools, "");

    expect(Object.keys(selected).length).toBe(Object.keys(allTools).length);
  });

  it("returns all tools when message is a greeting (no tool keywords)", () => {
    const allTools = makeMockTools() as Record<string, never>;
    const selected = selectRelevantTools(allTools, "Hello, how can you help me?");

    // Should fallback to all tools since no specific tools matched
    expect(Object.keys(selected).length).toBe(Object.keys(allTools).length);
  });

  it("reduces tool count for focused queries", () => {
    const allTools = makeMockTools() as Record<string, never>;
    const selected = selectRelevantTools(allTools, "Calculate the ROI for my campaign");

    // Should have fewer tools than the full set
    expect(Object.keys(selected).length).toBeLessThan(Object.keys(allTools).length);
    expect(selected).toHaveProperty("roi_calculator");
  });

  it("selects campaign tools for campaign creation", () => {
    const allTools = makeMockTools() as Record<string, never>;
    const selected = selectRelevantTools(
      allTools,
      "Create a new campaign for our winter launch with ₹2L budget"
    );

    expect(selected).toHaveProperty("campaign_builder");
    expect(selected).toHaveProperty("rate_benchmarker"); // ₹ keyword
  });
});

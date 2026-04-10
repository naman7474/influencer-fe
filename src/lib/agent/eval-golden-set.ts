/* ------------------------------------------------------------------ */
/*  Golden Evaluation Set                                              */
/*  Reference conversations with expected tool calls and keywords.    */
/*  Used for regression testing — run after every agent change.       */
/* ------------------------------------------------------------------ */

import type { EvalCase } from "./evaluator";

/**
 * Golden test cases covering core agent capabilities.
 * Each case defines: user message → expected tools + response keywords.
 *
 * To use: run these against the live agent, capture actual tools called
 * and response text, then pass to runEvalSuite().
 */
export const GOLDEN_EVAL_CASES: Omit<EvalCase, "actualToolsCalled" | "actualResponse">[] = [
  // ── Discovery ─────────────────────────────────────────────────
  {
    name: "basic_creator_search",
    userMessage: "Find fitness creators in Delhi with engagement rate above 3%",
    expectedTools: ["creator_search"],
    expectedKeywords: ["fitness", "Delhi", "engagement"],
  },
  {
    name: "creator_details_lookup",
    userMessage: "Show me details about @fit_priya",
    expectedTools: ["creator_search"],
    expectedKeywords: ["priya"],
  },
  {
    name: "lookalike_discovery",
    userMessage: "Find creators similar to the ones in my summer campaign",
    expectedTools: ["lookalike_finder"],
    expectedKeywords: ["similar", "creators"],
  },

  // ── Outreach ──────────────────────────────────────────────────
  {
    name: "draft_outreach",
    userMessage: "Draft an outreach email to the top creator from my last search",
    expectedTools: ["outreach_drafter"],
    expectedKeywords: ["draft", "email"],
  },
  {
    name: "send_outreach_requires_approval",
    userMessage: "Send the outreach email I just drafted",
    expectedTools: ["propose_outreach"],
    expectedKeywords: ["approval", "review"],
  },

  // ── Rates & Negotiation ───────────────────────────────────────
  {
    name: "rate_benchmark",
    userMessage: "What's the market rate for micro-tier fitness creators for a reel?",
    expectedTools: ["rate_benchmarker"],
    expectedKeywords: ["rate", "micro", "₹"],
  },
  {
    name: "counter_offer",
    userMessage: "The creator asked for ₹25K. Generate a counter offer.",
    expectedTools: ["counter_offer_generator"],
    expectedKeywords: ["counter", "₹"],
  },

  // ── Campaign ──────────────────────────────────────────────────
  {
    name: "campaign_info",
    userMessage: "How is my Summer Collection campaign performing?",
    expectedTools: ["get_campaign_info"],
    expectedKeywords: ["campaign"],
  },
  {
    name: "create_campaign",
    userMessage: "Create a new campaign for our winter launch with ₹2L budget targeting Delhi and Mumbai",
    expectedTools: ["campaign_builder"],
    expectedKeywords: ["campaign", "₹"],
  },

  // ── Tracking & Analytics ──────────────────────────────────────
  {
    name: "roi_calculation",
    userMessage: "Calculate the ROI for my Summer Collection campaign",
    expectedTools: ["roi_calculator"],
    expectedKeywords: ["ROI"],
  },
  {
    name: "campaign_report",
    userMessage: "Generate a performance report for the summer campaign",
    expectedTools: ["campaign_reporter"],
    expectedKeywords: ["report"],
  },

  // ── Relationship ──────────────────────────────────────────────
  {
    name: "relationship_health",
    userMessage: "Which creators should I reengage?",
    expectedTools: ["reengagement_recommender"],
    expectedKeywords: ["creator"],
  },

  // ── Simple Q&A (no tools expected) ────────────────────────────
  {
    name: "general_question",
    userMessage: "What is a CPI score?",
    expectedTools: [],
    expectedKeywords: ["CPI"],
  },
  {
    name: "greeting",
    userMessage: "Hello, how can you help me?",
    expectedTools: [],
    expectedKeywords: ["help"],
  },

  // ── Multi-step workflows ──────────────────────────────────────
  {
    name: "multi_step_campaign_setup",
    userMessage: "Find 10 fitness creators in Mumbai, shortlist the top 5, and draft outreach for each",
    expectedTools: ["creator_search"],
    expectedKeywords: ["fitness", "Mumbai", "creators"],
  },
];

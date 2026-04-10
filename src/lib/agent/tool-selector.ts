/* ------------------------------------------------------------------ */
/*  Dynamic Tool Selection                                             */
/*  Selects relevant tools based on user message to reduce token       */
/*  usage. Instead of passing all 29+ tools every turn, we pass only  */
/*  the relevant subset + a small set of always-available tools.       */
/* ------------------------------------------------------------------ */

import type { Tool } from "ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

/** Tools that are always available regardless of message content */
const ALWAYS_AVAILABLE = new Set([
  "creator_search",
  "get_creator_details",
  "get_campaign_info",
  "workflow_executor",
]);

/** Maximum tools to include per turn (excluding always-available) */
const MAX_DYNAMIC_TOOLS = 12;

/** Keyword → tool name mappings for fast relevance scoring */
const TOOL_KEYWORDS: Record<string, string[]> = {
  // Discovery
  creator_search: ["find", "search", "discover", "creator", "influencer", "creators", "influencers", "look for", "show me"],
  get_creator_details: ["details", "profile", "about", "who is", "info"],
  lookalike_finder: ["similar", "lookalike", "like", "alike", "comparable"],
  competitor_mapper: ["competitor", "rival", "competing", "competitive"],
  audience_overlap_check: ["overlap", "audience", "shared", "common followers"],
  geo_opportunity_finder: ["geo", "geography", "region", "city", "location", "area"],
  warm_lead_detector: ["warm", "lead", "mention", "organic", "already"],

  // Outreach
  outreach_drafter: ["outreach", "email", "draft", "write", "message", "reach out", "contact", "emails"],
  propose_outreach: ["send", "approve", "dispatch", "outreach", "email"],

  // Negotiation
  rate_benchmarker: ["rate", "price", "cost", "worth", "benchmark", "market rate", "how much", "₹", "budget"],
  counter_offer_generator: ["counter", "offer", "negotiate", "negotiation", "asked for", "asking"],
  budget_optimizer: ["budget", "optimize", "allocation", "spend", "spending"],
  deal_memo_generator: ["deal", "memo", "agreement", "terms", "contract"],

  // Campaign
  get_campaign_info: ["campaign", "how is", "performing", "status", "progress"],
  campaign_builder: ["create", "campaign", "new campaign", "launch", "set up", "start campaign"],
  discount_code_generator: ["discount", "code", "coupon", "promo"],
  utm_generator: ["utm", "link", "tracking link", "url"],
  brief_generator: ["brief", "content brief", "guidelines"],
  gifting_order_creator: ["gift", "gifting", "send product", "product seeding"],
  campaign_status_manager: ["activate", "pause", "complete", "launch", "status", "draft", "active"],

  // Tracking
  order_attributor: ["attribution", "attribute", "orders", "track"],
  content_monitor: ["content", "monitor", "submission", "posted", "submitted"],
  roi_calculator: ["roi", "return", "investment", "performance", "calculate"],
  geo_lift_analyzer: ["lift", "geo lift", "geographic impact"],
  campaign_reporter: ["report", "summary", "analysis", "generate report"],

  // Relationship
  relationship_scorer: ["relationship", "score", "health"],
  reengagement_recommender: ["reengage", "re-engage", "inactive", "dormant", "win back"],
  ambassador_identifier: ["ambassador", "top performer", "long-term", "loyal"],
  churn_predictor: ["churn", "risk", "at-risk", "losing", "dropping"],

  // Compliance
  compliance_scanner: ["compliance", "scan", "disclosure", "ad disclosure", "#ad"],
};

/**
 * Score how relevant a tool is to the given user message.
 * Returns a number 0-1 based on keyword matches.
 */
function scoreToolRelevance(toolName: string, messageLower: string): number {
  const keywords = TOOL_KEYWORDS[toolName];
  if (!keywords) return 0;

  let matchCount = 0;
  for (const kw of keywords) {
    if (messageLower.includes(kw)) {
      matchCount++;
    }
  }

  return keywords.length > 0 ? matchCount / keywords.length : 0;
}

/**
 * Select the most relevant tools for a given user message.
 *
 * Strategy:
 * 1. Always include ALWAYS_AVAILABLE tools
 * 2. Score remaining tools by keyword relevance
 * 3. Include top-scoring tools up to MAX_DYNAMIC_TOOLS
 * 4. If no tools score above threshold, include all (fallback)
 */
export function selectRelevantTools(
  allTools: Record<string, AnyTool>,
  userMessage: string
): Record<string, AnyTool> {
  if (!userMessage || userMessage.trim().length === 0) {
    return allTools; // No message to analyze — return all
  }

  const messageLower = userMessage.toLowerCase();
  const selected: Record<string, AnyTool> = {};

  // 1. Always include core tools
  for (const name of ALWAYS_AVAILABLE) {
    if (allTools[name]) {
      selected[name] = allTools[name];
    }
  }

  // 2. Score remaining tools
  const scored: { name: string; score: number }[] = [];
  for (const name of Object.keys(allTools)) {
    if (ALWAYS_AVAILABLE.has(name)) continue;
    const score = scoreToolRelevance(name, messageLower);
    if (score > 0) {
      scored.push({ name, score });
    }
  }

  // 3. Sort by score descending and take top N
  scored.sort((a, b) => b.score - a.score);
  const topTools = scored.slice(0, MAX_DYNAMIC_TOOLS);

  for (const { name } of topTools) {
    selected[name] = allTools[name];
  }

  // 4. Fallback: if we selected very few tools, include all
  // (the message might be ambiguous or a greeting)
  if (Object.keys(selected).length <= ALWAYS_AVAILABLE.size) {
    return allTools;
  }

  return selected;
}

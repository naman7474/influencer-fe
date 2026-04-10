/* ------------------------------------------------------------------ */
/*  Skill Catalog — Static metadata for UI display                     */
/*  This is the single source of truth for skill names, descriptions,  */
/*  and categories shown in the dashboard.                             */
/* ------------------------------------------------------------------ */

import type { SkillCategory, RiskLevel, SkillPermission } from "./types";

export interface SkillMeta {
  name: string;
  label: string;
  description: string;
  category: SkillCategory;
  permission: SkillPermission;
  riskLevel: RiskLevel;
}

export const CATEGORY_META: Record<
  SkillCategory,
  { label: string; description: string; icon: string; color: string }
> = {
  discovery: {
    label: "Discovery",
    description: "Find and analyze creators matching your brand",
    icon: "search",
    color: "blue",
  },
  outreach: {
    label: "Outreach",
    description: "Draft and send personalized emails to creators",
    icon: "mail",
    color: "violet",
  },
  negotiation: {
    label: "Negotiation",
    description: "Benchmark rates, counter-offers, and deal memos",
    icon: "handshake",
    color: "amber",
  },
  campaign: {
    label: "Campaign",
    description: "Create campaigns, briefs, discount codes, and gifting",
    icon: "target",
    color: "rose",
  },
  tracking: {
    label: "Tracking",
    description: "Monitor performance, ROI, content, and compliance",
    icon: "chart",
    color: "emerald",
  },
  relationship: {
    label: "Relationship",
    description: "Score loyalty, predict churn, and find re-engagement targets",
    icon: "heart",
    color: "cyan",
  },
};

export const SKILL_CATALOG: SkillMeta[] = [
  // ── Discovery ──
  {
    name: "creator_search",
    label: "Creator Search",
    description: "Search for creators by niche, location, tier, language, or engagement metrics. The core discovery tool.",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
  },
  {
    name: "get_creator_details",
    label: "Creator Profile",
    description: "Load a full creator profile including metrics, audience breakdown, content analysis, and match scores.",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
  },
  {
    name: "lookalike_finder",
    label: "Lookalike Finder",
    description: "Find creators similar to a reference creator based on niche, audience, and content style.",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
  },
  {
    name: "competitor_mapper",
    label: "Competitor Mapper",
    description: "Map which creators your competitors work with and identify opportunities.",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
  },
  {
    name: "audience_overlap_check",
    label: "Audience Overlap",
    description: "Detect audience overlap between creators to optimize reach and reduce redundancy.",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
  },
  {
    name: "geo_opportunity_finder",
    label: "Geo Opportunities",
    description: "Find geographic growth opportunities by matching creator audiences to your underserved markets.",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
  },
  {
    name: "warm_lead_detector",
    label: "Warm Lead Detector",
    description: "Identify creators who already mention your brand or have similar audience profiles — warm leads for outreach.",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
  },

  // ── Outreach ──
  {
    name: "outreach_drafter",
    label: "Outreach Drafter",
    description: "Draft personalized outreach emails with hooks based on creator content and brand fit.",
    category: "outreach",
    permission: "can_draft_outreach",
    riskLevel: "medium",
  },
  {
    name: "propose_outreach",
    label: "Submit for Approval",
    description: "Submit a drafted outreach email into the approval queue before sending to the creator.",
    category: "outreach",
    permission: "can_draft_outreach",
    riskLevel: "medium",
  },

  // ── Negotiation ──
  {
    name: "rate_benchmarker",
    label: "Rate Benchmarker",
    description: "Get market rate analysis by creator tier — median, range, and cost-per-engagement benchmarks.",
    category: "negotiation",
    permission: "can_negotiate",
    riskLevel: "low",
  },
  {
    name: "counter_offer_generator",
    label: "Counter-Offer Generator",
    description: "Generate data-backed counter-offers when negotiating creator rates.",
    category: "negotiation",
    permission: "can_negotiate",
    riskLevel: "medium",
  },
  {
    name: "budget_optimizer",
    label: "Budget Optimizer",
    description: "Analyze budget allocation across creators and campaigns for maximum ROI.",
    category: "negotiation",
    permission: "can_manage_budget",
    riskLevel: "low",
  },
  {
    name: "deal_memo_generator",
    label: "Deal Memo Generator",
    description: "Create formal deal memos summarizing agreed terms, deliverables, and timelines.",
    category: "negotiation",
    permission: "can_negotiate",
    riskLevel: "medium",
  },

  // ── Campaign ──
  {
    name: "get_campaign_info",
    label: "Campaign Info",
    description: "Retrieve details about existing campaigns including creators, status, and performance.",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "low",
  },
  {
    name: "campaign_builder",
    label: "Campaign Builder",
    description: "Create new campaigns with goals, budgets, creator assignments, and timelines.",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "high",
  },
  {
    name: "discount_code_generator",
    label: "Discount Codes",
    description: "Generate unique Shopify discount codes for campaign creators to share.",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "medium",
  },
  {
    name: "utm_generator",
    label: "UTM Generator",
    description: "Create UTM tracking links for campaign attribution and analytics.",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "low",
  },
  {
    name: "brief_generator",
    label: "Brief Generator",
    description: "Generate creative briefs with guidelines, dos/don'ts, and deliverable specs for creators.",
    category: "campaign",
    permission: "can_draft_outreach",
    riskLevel: "low",
  },
  {
    name: "gifting_order_creator",
    label: "Gifting Order",
    description: "Create Shopify draft orders to send product gifts to campaign creators.",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "high",
  },

  // ── Tracking ──
  {
    name: "order_attributor",
    label: "Order Attribution",
    description: "Attribute Shopify orders to specific creators using discount codes and UTM links.",
    category: "tracking",
    permission: "can_track_performance",
    riskLevel: "low",
  },
  {
    name: "content_monitor",
    label: "Content Monitor",
    description: "Track submitted content — what's been posted, what's pending, and engagement metrics.",
    category: "tracking",
    permission: "can_track_performance",
    riskLevel: "low",
  },
  {
    name: "roi_calculator",
    label: "ROI Calculator",
    description: "Calculate campaign ROI including revenue, cost, and return ratios per creator.",
    category: "tracking",
    permission: "can_track_performance",
    riskLevel: "low",
  },
  {
    name: "geo_lift_analyzer",
    label: "Geo Lift Analyzer",
    description: "Analyze geographic sales lift from creator campaigns across different regions.",
    category: "tracking",
    permission: "can_track_performance",
    riskLevel: "low",
  },
  {
    name: "campaign_reporter",
    label: "Campaign Reporter",
    description: "Generate comprehensive campaign performance reports with key metrics and insights.",
    category: "tracking",
    permission: "can_generate_reports",
    riskLevel: "low",
  },
  {
    name: "compliance_scanner",
    label: "Compliance Scanner",
    description: "Scan creator content for brand guideline violations, FTC compliance, and brand safety.",
    category: "tracking",
    permission: "can_scan_content",
    riskLevel: "low",
  },

  // ── Relationship ──
  {
    name: "relationship_scorer",
    label: "Relationship Scorer",
    description: "Score relationship health with creators based on campaigns, ROI, response rate, and activity.",
    category: "relationship",
    permission: "can_manage_relationships",
    riskLevel: "low",
  },
  {
    name: "reengagement_recommender",
    label: "Re-engagement Recommender",
    description: "Identify inactive creators worth re-engaging based on past performance and potential.",
    category: "relationship",
    permission: "can_manage_relationships",
    riskLevel: "low",
  },
  {
    name: "ambassador_identifier",
    label: "Ambassador Identifier",
    description: "Identify top creator candidates for ambassador programs — 3+ campaigns with 3x+ ROI.",
    category: "relationship",
    permission: "can_manage_relationships",
    riskLevel: "low",
  },
  {
    name: "churn_predictor",
    label: "Churn Predictor",
    description: "Predict which creator relationships are at risk of churning based on activity and engagement patterns.",
    category: "relationship",
    permission: "can_manage_relationships",
    riskLevel: "low",
  },
];

/** Get skills grouped by category */
export function getSkillsByCategory(): Record<SkillCategory, SkillMeta[]> {
  const grouped = {} as Record<SkillCategory, SkillMeta[]>;
  for (const skill of SKILL_CATALOG) {
    if (!grouped[skill.category]) grouped[skill.category] = [];
    grouped[skill.category].push(skill);
  }
  return grouped;
}

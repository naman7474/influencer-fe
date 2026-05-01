/* ------------------------------------------------------------------ */
/*  Discovery Skills — Find and analyze creators                       */
/* ------------------------------------------------------------------ */

import { registerSkills } from "../registry";
import type { SkillDefinition } from "../types";
import { creatorSearchTool } from "./creator-search";
import { creatorSemanticSearchTool } from "./creator-semantic-search";
import { getCreatorDetailsTool } from "./get-creator-details";
import { lookalikeFinder } from "./lookalike-finder";
import { competitorMapperTool } from "./competitor-mapper";
import { audienceOverlapCheckTool } from "./audience-overlap-check";
import { geoOpportunityFinderTool } from "./geo-opportunity-finder";
import { warmLeadDetectorTool } from "./warm-lead-detector";

const skills: SkillDefinition[] = [
  {
    name: "creator_search",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
    factory: creatorSearchTool,
  },
  {
    name: "creator_semantic_search",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
    factory: creatorSemanticSearchTool,
  },
  {
    name: "get_creator_details",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
    factory: getCreatorDetailsTool,
  },
  {
    name: "lookalike_finder",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
    factory: lookalikeFinder,
  },
  {
    name: "competitor_mapper",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
    factory: competitorMapperTool,
  },
  {
    name: "audience_overlap_check",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
    factory: audienceOverlapCheckTool,
  },
  {
    name: "geo_opportunity_finder",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
    factory: geoOpportunityFinderTool,
  },
  {
    name: "warm_lead_detector",
    category: "discovery",
    permission: "can_search_creators",
    riskLevel: "low",
    factory: warmLeadDetectorTool,
  },
];

registerSkills(skills);

export { creatorSearchTool } from "./creator-search";
export { creatorSemanticSearchTool } from "./creator-semantic-search";
export { getCreatorDetailsTool } from "./get-creator-details";
export { lookalikeFinder } from "./lookalike-finder";
export { competitorMapperTool } from "./competitor-mapper";
export { audienceOverlapCheckTool } from "./audience-overlap-check";
export { geoOpportunityFinderTool } from "./geo-opportunity-finder";
export { warmLeadDetectorTool } from "./warm-lead-detector";

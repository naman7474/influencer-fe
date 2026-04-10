/* ------------------------------------------------------------------ */
/*  Relationship Skills — Creator relationship management              */
/* ------------------------------------------------------------------ */

import { registerSkills } from "../registry";
import type { SkillDefinition } from "../types";
import { relationshipScorerTool } from "./relationship-scorer";
import { reengagementRecommenderTool } from "./reengagement-recommender";
import { ambassadorIdentifierTool } from "./ambassador-identifier";
import { churnPredictorTool } from "./churn-predictor";

const skills: SkillDefinition[] = [
  {
    name: "relationship_scorer",
    category: "relationship",
    permission: "can_manage_relationships",
    riskLevel: "low",
    factory: relationshipScorerTool,
  },
  {
    name: "reengagement_recommender",
    category: "relationship",
    permission: "can_manage_relationships",
    riskLevel: "low",
    factory: reengagementRecommenderTool,
  },
  {
    name: "ambassador_identifier",
    category: "relationship",
    permission: "can_manage_relationships",
    riskLevel: "low",
    factory: ambassadorIdentifierTool,
  },
  {
    name: "churn_predictor",
    category: "relationship",
    permission: "can_manage_relationships",
    riskLevel: "low",
    factory: churnPredictorTool,
  },
];

registerSkills(skills);

export { relationshipScorerTool } from "./relationship-scorer";
export { reengagementRecommenderTool } from "./reengagement-recommender";
export { ambassadorIdentifierTool } from "./ambassador-identifier";
export { churnPredictorTool } from "./churn-predictor";

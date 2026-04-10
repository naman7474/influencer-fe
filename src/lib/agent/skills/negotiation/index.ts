/* ------------------------------------------------------------------ */
/*  Negotiation Skills — Rate benchmarking and negotiation support     */
/* ------------------------------------------------------------------ */

import { registerSkills } from "../registry";
import type { SkillDefinition } from "../types";
import { rateBenchmarkerTool } from "./rate-benchmarker";
import { counterOfferGeneratorTool } from "./counter-offer-generator";
import { budgetOptimizerTool } from "./budget-optimizer";
import { dealMemoGeneratorTool } from "./deal-memo-generator";

const skills: SkillDefinition[] = [
  {
    name: "rate_benchmarker",
    category: "negotiation",
    permission: "can_negotiate",
    riskLevel: "low",
    factory: rateBenchmarkerTool,
  },
  {
    name: "counter_offer_generator",
    category: "negotiation",
    permission: "can_negotiate",
    riskLevel: "medium",
    factory: counterOfferGeneratorTool,
  },
  {
    name: "budget_optimizer",
    category: "negotiation",
    permission: "can_manage_budget",
    riskLevel: "low",
    factory: budgetOptimizerTool,
  },
  {
    name: "deal_memo_generator",
    category: "negotiation",
    permission: "can_negotiate",
    riskLevel: "medium",
    factory: dealMemoGeneratorTool,
  },
];

registerSkills(skills);

export { rateBenchmarkerTool } from "./rate-benchmarker";
export { counterOfferGeneratorTool } from "./counter-offer-generator";
export { budgetOptimizerTool } from "./budget-optimizer";
export { dealMemoGeneratorTool } from "./deal-memo-generator";

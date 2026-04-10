/* ------------------------------------------------------------------ */
/*  Outreach Skills — Email drafting and proposal                      */
/* ------------------------------------------------------------------ */

import { registerSkills } from "../registry";
import type { SkillDefinition } from "../types";
import { outreachDrafterTool } from "./outreach-drafter";
import { proposeOutreachTool } from "./propose-outreach";

const skills: SkillDefinition[] = [
  {
    name: "outreach_drafter",
    category: "outreach",
    permission: "can_draft_outreach",
    riskLevel: "medium",
    factory: outreachDrafterTool,
  },
  {
    name: "propose_outreach",
    category: "outreach",
    permission: "can_draft_outreach",
    riskLevel: "medium",
    factory: proposeOutreachTool,
  },
];

registerSkills(skills);

export { outreachDrafterTool } from "./outreach-drafter";
export { proposeOutreachTool } from "./propose-outreach";

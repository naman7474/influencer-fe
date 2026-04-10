/* ------------------------------------------------------------------ */
/*  Campaign Skills — Campaign management and operations               */
/* ------------------------------------------------------------------ */

import { registerSkills } from "../registry";
import type { SkillDefinition } from "../types";
import { getCampaignInfoTool } from "./get-campaign-info";
import { campaignBuilderTool } from "./campaign-builder";
import { discountCodeGeneratorTool } from "./discount-code-generator";
import { utmGeneratorTool } from "./utm-generator";
import { briefGeneratorTool } from "./brief-generator";
import { giftingOrderCreatorTool } from "./gifting-order-creator";
import { campaignStatusManagerTool } from "./campaign-status-manager";

const skills: SkillDefinition[] = [
  {
    name: "get_campaign_info",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "low",
    factory: getCampaignInfoTool,
  },
  {
    name: "campaign_builder",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "high",
    factory: campaignBuilderTool,
  },
  {
    name: "discount_code_generator",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "medium",
    factory: discountCodeGeneratorTool,
  },
  {
    name: "utm_generator",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "low",
    factory: utmGeneratorTool,
  },
  {
    name: "brief_generator",
    category: "campaign",
    permission: "can_draft_outreach",
    riskLevel: "low",
    factory: briefGeneratorTool,
  },
  {
    name: "gifting_order_creator",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "high",
    factory: giftingOrderCreatorTool,
  },
  {
    name: "campaign_status_manager",
    category: "campaign",
    permission: "can_manage_campaigns",
    riskLevel: "medium",
    factory: campaignStatusManagerTool,
  },
];

registerSkills(skills);

export { getCampaignInfoTool } from "./get-campaign-info";
export { campaignBuilderTool } from "./campaign-builder";
export { discountCodeGeneratorTool } from "./discount-code-generator";
export { utmGeneratorTool } from "./utm-generator";
export { briefGeneratorTool } from "./brief-generator";
export { giftingOrderCreatorTool } from "./gifting-order-creator";
export { campaignStatusManagerTool } from "./campaign-status-manager";

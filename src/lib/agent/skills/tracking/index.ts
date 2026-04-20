/* ------------------------------------------------------------------ */
/*  Tracking Skills — Performance tracking and analytics               */
/* ------------------------------------------------------------------ */

import { registerSkills } from "../registry";
import type { SkillDefinition } from "../types";
import { orderAttributorTool } from "./order-attributor";
import { contentMonitorTool } from "./content-monitor";
import { roiCalculatorTool } from "./roi-calculator";
import { geoLiftAnalyzerTool } from "./geo-lift-analyzer";
import { campaignReporterTool } from "./campaign-reporter";
import { complianceScannerTool } from "./compliance-scanner";
import { contentAnalyzerTool } from "./content-analyzer";

const skills: SkillDefinition[] = [
  {
    name: "order_attributor",
    category: "tracking",
    permission: "can_track_performance",
    riskLevel: "low",
    factory: orderAttributorTool,
  },
  {
    name: "content_monitor",
    category: "tracking",
    permission: "can_track_performance",
    riskLevel: "low",
    factory: contentMonitorTool,
  },
  {
    name: "roi_calculator",
    category: "tracking",
    permission: "can_track_performance",
    riskLevel: "low",
    factory: roiCalculatorTool,
  },
  {
    name: "geo_lift_analyzer",
    category: "tracking",
    permission: "can_track_performance",
    riskLevel: "low",
    factory: geoLiftAnalyzerTool,
  },
  {
    name: "campaign_reporter",
    category: "tracking",
    permission: "can_generate_reports",
    riskLevel: "low",
    factory: campaignReporterTool,
  },
  {
    name: "compliance_scanner",
    category: "tracking",
    permission: "can_scan_content",
    riskLevel: "low",
    factory: complianceScannerTool,
  },
  {
    name: "content_analyzer",
    category: "tracking",
    permission: "can_scan_content",
    riskLevel: "low",
    factory: contentAnalyzerTool,
  },
];

registerSkills(skills);

export { orderAttributorTool } from "./order-attributor";
export { contentMonitorTool } from "./content-monitor";
export { roiCalculatorTool } from "./roi-calculator";
export { geoLiftAnalyzerTool } from "./geo-lift-analyzer";
export { campaignReporterTool } from "./campaign-reporter";
export { complianceScannerTool } from "./compliance-scanner";
export { contentAnalyzerTool } from "./content-analyzer";

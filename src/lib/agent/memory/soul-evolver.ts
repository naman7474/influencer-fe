/* ------------------------------------------------------------------ */
/*  SOUL.md Evolver                                                    */
/*  Updates the SOUL.md procedural memory with learned decision rules  */
/*  derived from high-confidence semantic knowledge.                   */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";

const RULES_MARKER = "## Learned Decision Rules";
const MAX_RULES = 20;
const MIN_CONFIDENCE = 0.65;
const MIN_EVIDENCE = 3;

/** Categories for grouping rules in SOUL.md */
const RULE_CATEGORIES: Record<string, string[]> = {
  Outreach: ["outreach_pattern", "timing_pattern"],
  "Creator Selection": ["niche_insight", "creator_insight"],
  Negotiation: ["negotiation_strategy", "rate_benchmark"],
  "Brand Preferences": ["brand_preference", "content_performance"],
};

interface KnowledgeRow {
  id: string;
  knowledge_type: string;
  fact: string;
  confidence: number;
  evidence_count: number;
}

/**
 * Parse SOUL.md into base content (human-written) and rules section.
 */
export function parseSoulMd(soulMd: string): {
  base: string;
  rules: string;
} {
  const markerIdx = soulMd.indexOf(RULES_MARKER);
  if (markerIdx === -1) {
    return { base: soulMd.trimEnd(), rules: "" };
  }
  return {
    base: soulMd.substring(0, markerIdx).trimEnd(),
    rules: soulMd.substring(markerIdx),
  };
}

/**
 * Format knowledge items into the rules section of SOUL.md.
 */
export function formatRulesSection(items: KnowledgeRow[]): string {
  if (items.length === 0) return "";

  // Group by category
  const grouped: Record<string, KnowledgeRow[]> = {};

  for (const item of items) {
    let category = "General";
    for (const [cat, types] of Object.entries(RULE_CATEGORIES)) {
      if (types.includes(item.knowledge_type)) {
        category = cat;
        break;
      }
    }
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  }

  let section = `${RULES_MARKER}\n`;

  for (const [category, categoryItems] of Object.entries(grouped)) {
    section += `\n### ${category}\n`;
    for (const item of categoryItems) {
      const pct = Math.round(item.confidence * 100);
      section += `- ${item.fact} (${pct}% confidence, ${item.evidence_count} data points)\n`;
    }
  }

  return section;
}

/**
 * Evolve the SOUL.md document by appending/updating learned decision rules.
 *
 * 1. Query agent_knowledge for high-confidence, well-evidenced items
 * 2. Group into categories
 * 3. Format as rules section
 * 4. Merge with existing SOUL.md (preserve human-written base)
 * 5. Write back to agent_config.soul_md
 */
export async function evolveSoulMd(
  brandId: string,
  supabase: SupabaseClient
): Promise<{ updated: boolean; ruleCount: number }> {
  // 1. Load current SOUL.md
  const { data: configRaw } = await supabase
    .from("agent_config")
    .select("soul_md")
    .eq("brand_id", brandId)
    .single();
  const config = configRaw as Record<string, unknown> | null;

  if (!config) {
    return { updated: false, ruleCount: 0 };
  }

  const currentSoulMd = (config.soul_md as string) || "";

  // 2. Query high-confidence knowledge
  const { data: knowledgeRaw } = await supabase
    .from("agent_knowledge")
    .select("id, knowledge_type, fact, confidence, evidence_count")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .gte("confidence", MIN_CONFIDENCE)
    .gte("evidence_count", MIN_EVIDENCE)
    .order("confidence", { ascending: false })
    .limit(MAX_RULES);

  const knowledge = (knowledgeRaw || []) as KnowledgeRow[];

  // 3. Parse existing SOUL.md
  const { base } = parseSoulMd(currentSoulMd);

  // 4. Format new rules section
  const rulesSection = formatRulesSection(knowledge);

  // 5. Merge: base + rules
  const newSoulMd = rulesSection
    ? `${base}\n\n${rulesSection}`
    : base;

  // 6. Write back only if changed
  if (newSoulMd.trim() === currentSoulMd.trim()) {
    return { updated: false, ruleCount: knowledge.length };
  }

  await supabase
    .from("agent_config")
    .update({ soul_md: newSoulMd, updated_at: new Date().toISOString() } as never)
    .eq("brand_id", brandId);

  return { updated: true, ruleCount: knowledge.length };
}

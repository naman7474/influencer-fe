/* ------------------------------------------------------------------ */
/*  Knowledge Writer                                                   */
/*  Extracts semantic knowledge from agent interactions and tool       */
/*  results. Uses structured rules (not LLM) to keep costs low.       */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeType =
  | "rate_benchmark"
  | "niche_insight"
  | "brand_preference"
  | "outreach_pattern"
  | "negotiation_strategy"
  | "creator_insight"
  | "timing_pattern"
  | "content_performance";

interface WriteKnowledgeParams {
  brandId: string;
  knowledgeType: KnowledgeType;
  fact: string;
  details?: Record<string, unknown>;
  sourceEpisodeId?: string;
  sourceCampaignId?: string;
  supabase: SupabaseClient;
}

/**
 * Confidence calculation when reinforcing an existing fact.
 * Approaches 1.0 asymptotically: new = min(0.99, c + (1 - c) * 0.15)
 */
export function reinforceConfidence(current: number): number {
  return Math.min(0.99, current + (1 - current) * 0.15);
}

/**
 * Confidence calculation when contradicting an existing fact.
 * Decreases multiplicatively: new = max(0.05, c - c * 0.20)
 */
export function contradictConfidence(current: number): number {
  return Math.max(0.05, current - current * 0.2);
}

/**
 * Write or reinforce a knowledge item.
 *
 * 1. Search for existing similar knowledge (keyword match on fact)
 * 2. If found: reinforce or contradict based on similarity
 * 3. If not found: insert new with confidence 0.50
 */
export async function writeKnowledge(
  params: WriteKnowledgeParams
): Promise<{ action: "created" | "reinforced" | "error"; id?: string }> {
  const {
    brandId,
    knowledgeType,
    fact,
    details,
    sourceEpisodeId,
    sourceCampaignId,
    supabase,
  } = params;

  if (!fact || fact.trim().length === 0) {
    return { action: "error" };
  }

  // 1. Search for existing similar knowledge
  const existing = await findSimilarKnowledge(
    brandId,
    knowledgeType,
    fact,
    supabase
  );

  if (existing) {
    // 2. Reinforce the existing item
    const newConfidence = reinforceConfidence(existing.confidence as number);
    const episodeIds = [
      ...((existing.source_episode_ids as string[]) || []),
    ];
    if (sourceEpisodeId && !episodeIds.includes(sourceEpisodeId)) {
      episodeIds.push(sourceEpisodeId);
    }
    const campaignIds = [
      ...((existing.source_campaign_ids as string[]) || []),
    ];
    if (sourceCampaignId && !campaignIds.includes(sourceCampaignId)) {
      campaignIds.push(sourceCampaignId);
    }

    await supabase
      .from("agent_knowledge")
      .update({
        confidence: newConfidence,
        evidence_count: ((existing.evidence_count as number) || 1) + 1,
        reinforced_count: ((existing.reinforced_count as number) || 0) + 1,
        last_reinforced_at: new Date().toISOString(),
        source_episode_ids: episodeIds,
        source_campaign_ids: campaignIds,
        details: details ?? existing.details,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", existing.id);

    return { action: "reinforced", id: existing.id as string };
  }

  // 3. Insert new knowledge
  const { data, error } = await supabase
    .from("agent_knowledge")
    .insert({
      brand_id: brandId,
      knowledge_type: knowledgeType,
      fact: fact.trim(),
      details: details || {},
      confidence: 0.5,
      evidence_count: 1,
      source_episode_ids: sourceEpisodeId ? [sourceEpisodeId] : [],
      source_campaign_ids: sourceCampaignId ? [sourceCampaignId] : [],
    } as never)
    .select("id")
    .single();

  if (error) {
    return { action: "error" };
  }

  const row = data as Record<string, unknown> | null;
  return { action: "created", id: row?.id as string };
}

/**
 * Contradict an existing knowledge item (reduce confidence).
 */
export async function contradictKnowledge(
  knowledgeId: string,
  brandId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data } = await supabase
    .from("agent_knowledge")
    .select("confidence, contradicted_count")
    .eq("id", knowledgeId)
    .eq("brand_id", brandId)
    .single();
  const row = data as Record<string, unknown> | null;
  if (!row) return;

  const newConfidence = contradictConfidence(row.confidence as number);

  await supabase
    .from("agent_knowledge")
    .update({
      confidence: newConfidence,
      contradicted_count: ((row.contradicted_count as number) || 0) + 1,
      last_contradicted_at: new Date().toISOString(),
      is_active: newConfidence >= 0.05,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", knowledgeId)
    .eq("brand_id", brandId);
}

/**
 * Extract knowledge from a rate benchmark tool result.
 */
export async function extractFromRateBenchmark(
  brandId: string,
  toolResult: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<void> {
  const marketRate = toolResult.market_rate as Record<string, unknown> | null;
  const creatorSpecific = toolResult.creator_specific as Record<string, unknown> | null;
  const tier = toolResult.tier as string;

  if (marketRate) {
    await writeKnowledge({
      brandId,
      knowledgeType: "rate_benchmark",
      fact: `${capitalize(tier)}-tier creators: market rate ₹${marketRate.min}–₹${marketRate.max} (median ₹${marketRate.median})`,
      details: { tier, ...marketRate },
      supabase,
    });
  }

  if (creatorSpecific?.handle) {
    await writeKnowledge({
      brandId,
      knowledgeType: "creator_insight",
      fact: `@${creatorSpecific.handle} (${tier}): CPI ${creatorSpecific.cpi}, ER ${creatorSpecific.engagement_rate}%`,
      details: { ...creatorSpecific, tier },
      supabase,
    });
  }
}

/**
 * Extract knowledge from outreach approval/rejection.
 */
export async function extractFromOutreachOutcome(
  brandId: string,
  outcome: "approved" | "rejected",
  details: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<void> {
  if (outcome === "rejected" && details.rejection_reason) {
    await writeKnowledge({
      brandId,
      knowledgeType: "brand_preference",
      fact: `Outreach rejected: ${details.rejection_reason}`,
      details,
      supabase,
    });
  }
}

/* ── Internal helpers ───────────────────────────────────────────── */

async function findSimilarKnowledge(
  brandId: string,
  knowledgeType: string,
  fact: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown> | null> {
  // Extract keywords from the fact for keyword search
  const keywords = fact
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);

  if (keywords.length === 0) return null;

  // Search for existing knowledge with matching type and overlapping keywords
  const { data } = await supabase
    .from("agent_knowledge")
    .select("*")
    .eq("brand_id", brandId)
    .eq("knowledge_type", knowledgeType)
    .eq("is_active", true)
    .order("confidence", { ascending: false })
    .limit(10);

  const items = (data || []) as Record<string, unknown>[];

  // Simple keyword overlap scoring
  for (const item of items) {
    const itemFact = (item.fact as string).toLowerCase();
    const matchCount = keywords.filter((kw) => itemFact.includes(kw)).length;
    if (matchCount >= Math.ceil(keywords.length * 0.5)) {
      return item;
    }
  }

  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

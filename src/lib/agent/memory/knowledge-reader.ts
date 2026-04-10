/* ------------------------------------------------------------------ */
/*  Knowledge Reader                                                   */
/*  Queries semantic knowledge for runtime injection into system prompt */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface KnowledgeItem {
  id: string;
  knowledge_type: string;
  fact: string;
  confidence: number;
  evidence_count: number;
  created_at: string;
}

/**
 * Retrieve relevant knowledge for the current conversation context.
 * Uses keyword search (same approach as episodic memory retrieval).
 */
export async function retrieveKnowledge(
  brandId: string,
  userMessage: string,
  supabase: SupabaseClient,
  limit = 5,
  minConfidence = 0.4
): Promise<KnowledgeItem[]> {
  if (!userMessage || userMessage.trim().length === 0) {
    return getRecentHighConfidenceKnowledge(brandId, supabase, limit);
  }

  // Extract keywords from user message
  const keywords = userMessage
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4)
    .join(" ");

  if (!keywords) {
    return getRecentHighConfidenceKnowledge(brandId, supabase, limit);
  }

  // Try keyword search via RPC
  const { data } = await supabase.rpc("fn_search_agent_knowledge_keyword", {
    p_brand_id: brandId,
    p_query: keywords,
    p_knowledge_types: null,
    p_min_confidence: minConfidence,
    p_limit: limit,
  });

  const results = (data || []) as KnowledgeItem[];

  // If keyword search yields nothing, fall back to high-confidence recent items
  if (results.length === 0) {
    return getRecentHighConfidenceKnowledge(brandId, supabase, limit);
  }

  return results;
}

/**
 * Fallback: get the most confident, most recent knowledge items.
 */
async function getRecentHighConfidenceKnowledge(
  brandId: string,
  supabase: SupabaseClient,
  limit: number
): Promise<KnowledgeItem[]> {
  const { data } = await supabase
    .from("agent_knowledge")
    .select("id, knowledge_type, fact, confidence, evidence_count, created_at")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .gte("confidence", 0.6)
    .order("confidence", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data || []) as KnowledgeItem[];
}

/**
 * Format knowledge items for inclusion in the system prompt.
 */
export function formatKnowledgeForPrompt(items: KnowledgeItem[]): string {
  if (items.length === 0) return "";

  const lines = items.map((item) => {
    const pct = Math.round(item.confidence * 100);
    return `- [${item.knowledge_type}, ${pct}% confidence] ${item.fact}`;
  });

  return `## Relevant Knowledge\n${lines.join("\n")}`;
}

/* ------------------------------------------------------------------ */
/*  Vector Search Module                                               */
/*  Semantic search over agent_episodes and agent_knowledge via        */
/*  pgvector embeddings. Falls back to keyword search when embeddings  */
/*  are unavailable.                                                   */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./embeddings";
import type { KnowledgeItem } from "./knowledge-reader";

/* ── Stop words to filter from keyword queries ────────────────────── */

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "it", "in", "on", "at", "to", "for",
  "of", "and", "or", "but", "not", "with", "this", "that", "from",
  "by", "be", "as", "are", "was", "were", "been", "has", "had",
  "have", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "can", "what", "which", "who", "whom", "how",
  "when", "where", "why", "if", "than", "then", "so", "no", "yes",
  "all", "any", "each", "every", "both", "few", "more", "most",
  "some", "such", "only", "own", "same", "too", "very", "just",
  "about", "above", "after", "again", "also", "am", "because",
  "before", "being", "between", "here", "there", "into", "its",
  "me", "my", "out", "our", "them", "their", "they", "these",
  "those", "through", "under", "until", "up", "we", "you", "your",
  "i", "he", "she", "her", "him", "his",
]);

/**
 * Build a keyword search query from a user message.
 * Filters stop words and keeps meaningful terms.
 */
export function buildSearchQuery(message: string): string {
  if (!message || message.trim().length === 0) return "";

  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 6)
    .join(" ");
}

/* ── Episode types ────────────────────────────────────────────────── */

interface EpisodeSearchResult {
  id: string;
  summary: string;
  episode_type: string;
  created_at: string;
  similarity?: number;
}

/**
 * Search episodes using vector similarity, falling back to keyword search.
 */
export async function searchEpisodesByVector(
  brandId: string,
  query: string,
  supabase: SupabaseClient,
  limit = 5
): Promise<EpisodeSearchResult[]> {
  const keywords = buildSearchQuery(query);

  // Try vector search first
  const embedding = query.trim() ? await generateEmbedding(query) : null;

  if (embedding) {
    const { data, error } = await supabase.rpc("fn_search_episodes_by_embedding", {
      p_brand_id: brandId,
      p_embedding: embedding,
      p_limit: limit,
      p_min_similarity: 0.3,
    });

    if (!error && data && (data as EpisodeSearchResult[]).length > 0) {
      return data as EpisodeSearchResult[];
    }
    // Vector search failed or returned no results — fall through to keyword
  }

  // Keyword fallback
  if (keywords) {
    const { data } = await supabase.rpc("fn_search_agent_episodes_keyword", {
      p_brand_id: brandId,
      p_query: keywords,
      p_limit: limit,
    });

    if (data && (data as EpisodeSearchResult[]).length > 0) {
      return data as EpisodeSearchResult[];
    }
  }

  // Final fallback: recent episodes
  const { data } = await supabase
    .from("agent_episodes")
    .select("id, summary, episode_type, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 3));

  return (data || []) as EpisodeSearchResult[];
}

/**
 * Search knowledge using vector similarity, falling back to keyword search.
 */
export async function searchKnowledgeByVector(
  brandId: string,
  query: string,
  supabase: SupabaseClient,
  limit = 5,
  minConfidence = 0.4
): Promise<KnowledgeItem[]> {
  const keywords = buildSearchQuery(query);

  // Try vector search first
  const embedding = query.trim() ? await generateEmbedding(query) : null;

  if (embedding) {
    const { data, error } = await supabase.rpc("fn_search_knowledge_by_embedding", {
      p_brand_id: brandId,
      p_embedding: embedding,
      p_min_confidence: minConfidence,
      p_limit: limit,
      p_min_similarity: 0.3,
    });

    if (!error && data && (data as KnowledgeItem[]).length > 0) {
      return data as KnowledgeItem[];
    }
  }

  // Keyword fallback
  if (keywords) {
    const { data } = await supabase.rpc("fn_search_agent_knowledge_keyword", {
      p_brand_id: brandId,
      p_query: keywords,
      p_knowledge_types: null,
      p_min_confidence: minConfidence,
      p_limit: limit,
    });

    if (data && (data as KnowledgeItem[]).length > 0) {
      return data as KnowledgeItem[];
    }
  }

  // Final fallback: high-confidence recent items
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

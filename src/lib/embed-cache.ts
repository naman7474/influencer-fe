import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

/**
 * Shared OpenAI embedding cache.
 *
 * The Discover API and the agent's `creator_semantic_search` tool both
 * embed user-typed queries. Without a cache, the same query — typed by
 * the same user as they tweak filters, or by different users searching
 * for the same intent — re-hits OpenAI on every search. This module
 * centralises a per-process LRU so the second call is a Map lookup.
 *
 * Eviction: when the cache is at capacity we drop the oldest entry
 * (Map preserves insertion order; we delete + re-insert on hit to bump
 * recency).
 *
 * Cache scope: per Node process. In a multi-instance deployment each
 * worker has its own cache — that's fine because OpenAI's embedding for
 * the same input is deterministic, and a stale entry doesn't exist (we
 * never invalidate, the model is fixed via EMBEDDING_MODEL).
 *
 * If we ever switch models, redeploys clear the cache implicitly.
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const CACHE_MAX = 512;

const cache = new Map<string, number[]>();

/**
 * Embed a query string, returning the cached vector when one exists.
 * Trims + lowercases the key so trivial whitespace / casing variations
 * map to the same entry.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const key = text.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) {
    // Bump LRU recency by re-inserting at the tail.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, embedding);
  return embedding;
}

/** Test/debug: drop everything. Not used in app code. */
export function _clearEmbedCache(): void {
  cache.clear();
}

/**
 * Cross-encoder reranking for creator search results (Phase 3 of the
 * agent-search plan).
 *
 * The hybrid retrieval RPC (`fn_hybrid_search_creators`) returns up to 50
 * candidates ranked by Reciprocal Rank Fusion of BM25 + vector similarity.
 * That's a good "recall" stage — the right creators are usually in there —
 * but the top-10 ordering is rough. A cross-encoder reranker scoring each
 * (query, candidate) pair lifts NDCG@10 by 33–48% in published benchmarks.
 *
 * This module provides `rerank()` with two backends:
 *   1. Cohere Rerank v3.5 (when COHERE_API_KEY is set) — production-grade,
 *      multilingual (Hindi, Tamil, Telugu, etc. — matters for Indian
 *      creators), single HTTP call, ~150–400ms for 50 candidates.
 *   2. No-op fallback (when no key is set) — returns candidates unchanged
 *      so semantic search still works without a rerank step.
 *
 * Swap to Voyage Rerank, ZeroEntropy, or a self-hosted FlashRank by
 * replacing the implementation behind the same function signature.
 */

const COHERE_RERANK_URL = "https://api.cohere.com/v2/rerank";
const COHERE_MODEL = "rerank-v3.5";
const COHERE_TIMEOUT_MS = 4_000;

interface CohereRerankResponse {
  results: Array<{ index: number; relevance_score: number }>;
  // Cohere also returns `meta`; we don't use it here.
}

/**
 * Rerank `candidates` against `query` using a cross-encoder.
 *
 * Returns the candidates re-sorted by relevance, each annotated with a
 * `rerank_score` in [0, 1]. Truncated to `topK`. When the reranker is
 * unavailable (no API key, network error, timeout), returns the input
 * candidates unchanged but capped at `topK` and without `rerank_score`.
 *
 * The `getText` accessor lets callers control which field of T to send
 * to the reranker — for creator briefs we send the `summary` line, which
 * is already a tight, signal-dense one-liner.
 */
export async function rerank<T>({
  query,
  candidates,
  getText,
  topK = 10,
}: {
  query: string;
  candidates: T[];
  getText: (c: T) => string;
  topK?: number;
}): Promise<Array<T & { rerank_score?: number }>> {
  const apiKey = process.env.COHERE_API_KEY;
  // No-op fallback: nothing to rerank, or the user hasn't configured a
  // reranker. Just truncate to topK so the UX is consistent.
  if (!apiKey || candidates.length === 0) {
    return candidates.slice(0, topK) as Array<T & { rerank_score?: number }>;
  }

  // Build the documents list. Skip candidates whose text is empty —
  // sending empty strings to Cohere wastes a slot and risks a 400.
  const documents: string[] = [];
  const indexMap: number[] = []; // documents[i] came from candidates[indexMap[i]]
  for (let i = 0; i < candidates.length; i += 1) {
    const text = getText(candidates[i]).trim();
    if (text.length === 0) continue;
    documents.push(text);
    indexMap.push(i);
  }
  if (documents.length === 0) {
    return candidates.slice(0, topK) as Array<T & { rerank_score?: number }>;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COHERE_TIMEOUT_MS);
    const response = await fetch(COHERE_RERANK_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: COHERE_MODEL,
        query,
        documents,
        top_n: Math.min(topK, documents.length),
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      // Don't fail the whole search because rerank glitched — log and
      // hand back the original ordering.
      console.warn(
        `[rerank] Cohere returned ${response.status}; falling back to RRF order`,
      );
      return candidates.slice(0, topK) as Array<T & { rerank_score?: number }>;
    }
    const data = (await response.json()) as CohereRerankResponse;
    return data.results.map((r) => ({
      ...candidates[indexMap[r.index]],
      rerank_score: r.relevance_score,
    }));
  } catch (e) {
    console.warn(
      `[rerank] Cohere call failed (${e instanceof Error ? e.message : String(e)}); falling back to RRF order`,
    );
    return candidates.slice(0, topK) as Array<T & { rerank_score?: number }>;
  }
}

/** True when a reranker is configured. Useful for telemetry / tracing. */
export function isRerankerEnabled(): boolean {
  return Boolean(process.env.COHERE_API_KEY);
}

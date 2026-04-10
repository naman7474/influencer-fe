/* ------------------------------------------------------------------ */
/*  Composite Memory Scorer                                            */
/*  Ranks retrieved memories by combining semantic similarity,         */
/*  recency decay, and importance for optimal context injection.       */
/* ------------------------------------------------------------------ */

/** Weights for composite scoring — must sum to 1.0 */
const SIMILARITY_WEIGHT = 0.5;
const RECENCY_WEIGHT = 0.3;
const IMPORTANCE_WEIGHT = 0.2;

/** Decay constant: higher = faster decay. 0.05 gives ~50% at 14 days */
const DECAY_LAMBDA = 0.05;

/**
 * Compute time-based recency decay using exponential decay.
 * Returns value in [0, 1] where 1 = just created, 0 = very old.
 *
 * Formula: e^(-λ × days_since_creation)
 */
export function computeRecencyDecay(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = Math.max(0, ageMs / (24 * 60 * 60 * 1000));
  return Math.exp(-DECAY_LAMBDA * ageDays);
}

/**
 * Compute composite score from similarity, recency, and importance.
 * Returns value in [0, 1].
 */
export function computeCompositeScore(params: {
  similarity: number;
  recencyDecay: number;
  importance: number;
}): number {
  return (
    params.similarity * SIMILARITY_WEIGHT +
    params.recencyDecay * RECENCY_WEIGHT +
    params.importance * IMPORTANCE_WEIGHT
  );
}

/* ── Memory ranking ───────────────────────────────────────────────── */

interface ScoredMemory {
  id: string;
  summary: string;
  episode_type: string;
  created_at: string;
  similarity?: number;
  importance?: number;
  /** Attached by rankMemories for transparency */
  _compositeScore?: number;
}

/**
 * Rank memories by composite score and return the top N.
 * Items without similarity default to 0.5 (keyword-matched).
 * Items without importance default to 0.5.
 */
export function rankMemories(
  items: ScoredMemory[],
  limit?: number
): (ScoredMemory & { _compositeScore: number })[] {
  if (items.length === 0) return [];

  const scored = items.map((item) => {
    const similarity = item.similarity ?? 0.5;
    const importance = item.importance ?? 0.5;
    const recencyDecay = computeRecencyDecay(item.created_at);

    const _compositeScore = computeCompositeScore({
      similarity,
      recencyDecay,
      importance,
    });

    return { ...item, _compositeScore };
  });

  scored.sort((a, b) => b._compositeScore - a._compositeScore);

  return limit ? scored.slice(0, limit) : scored;
}

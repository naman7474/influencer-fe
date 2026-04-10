/* ------------------------------------------------------------------ */
/*  Embedding Generation Utility                                       */
/*  Generates vector embeddings for memory retrieval via pgvector       */
/* ------------------------------------------------------------------ */

import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_TEXT_LENGTH = 8192;

/**
 * Generate a single embedding vector for a text string.
 * Returns null on failure (caller should fall back to keyword search).
 */
export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  if (!text || text.trim().length === 0) return null;

  try {
    const truncated = text.slice(0, MAX_TEXT_LENGTH);
    const { embedding } = await embed({
      model: openai.embedding(EMBEDDING_MODEL),
      value: truncated,
    });
    return embedding;
  } catch {
    // Graceful degradation — caller falls back to keyword search
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * Returns empty array on failure.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    const truncated = texts.map((t) => t.slice(0, MAX_TEXT_LENGTH));
    const { embeddings } = await embedMany({
      model: openai.embedding(EMBEDDING_MODEL),
      values: truncated,
    });
    return embeddings;
  } catch {
    return [];
  }
}

/**
 * Cosine similarity between two vectors.
 * Returns value in [-1, 1] where 1 = identical, 0 = orthogonal.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

-- ============================================================
-- Phase 6A.1: Vector search for agent memory
-- Adds pgvector extension and cosine similarity search functions
-- for agent_episodes and agent_knowledge tables.
-- ============================================================

-- Enable pgvector extension (Supabase has this available)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Ensure embedding columns exist (should already from types) ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_episodes' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE agent_episodes ADD COLUMN embedding vector(1536);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_knowledge' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE agent_knowledge ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- ── Add importance column to episodes for composite scoring ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_episodes' AND column_name = 'importance'
  ) THEN
    ALTER TABLE agent_episodes ADD COLUMN importance NUMERIC(3,2) DEFAULT 0.5;
  END IF;
END $$;

-- ── Indexes for vector similarity search (IVFFlat) ──

CREATE INDEX IF NOT EXISTS idx_agent_episodes_embedding
  ON agent_episodes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_embedding
  ON agent_knowledge USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- ── Vector search function for episodes ──

CREATE OR REPLACE FUNCTION fn_search_episodes_by_embedding(
  p_brand_id UUID,
  p_embedding vector(1536),
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE(
  id UUID,
  summary TEXT,
  episode_type TEXT,
  created_at TIMESTAMPTZ,
  importance NUMERIC,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.summary,
    e.episode_type,
    e.created_at,
    COALESCE(e.importance, 0.5) AS importance,
    (1 - (e.embedding <=> p_embedding))::FLOAT AS similarity
  FROM agent_episodes e
  WHERE e.brand_id = p_brand_id
    AND e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> p_embedding)) >= p_min_similarity
  ORDER BY e.embedding <=> p_embedding ASC
  LIMIT p_limit;
END;
$$;

-- ── Vector search function for knowledge ──

CREATE OR REPLACE FUNCTION fn_search_knowledge_by_embedding(
  p_brand_id UUID,
  p_embedding vector(1536),
  p_min_confidence FLOAT DEFAULT 0.4,
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE(
  id UUID,
  knowledge_type TEXT,
  fact TEXT,
  confidence NUMERIC,
  evidence_count INT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.knowledge_type,
    k.fact,
    k.confidence,
    k.evidence_count,
    k.created_at,
    (1 - (k.embedding <=> p_embedding))::FLOAT AS similarity
  FROM agent_knowledge k
  WHERE k.brand_id = p_brand_id
    AND k.is_active = TRUE
    AND k.confidence >= p_min_confidence
    AND k.embedding IS NOT NULL
    AND (1 - (k.embedding <=> p_embedding)) >= p_min_similarity
  ORDER BY k.embedding <=> p_embedding ASC
  LIMIT p_limit;
END;
$$;

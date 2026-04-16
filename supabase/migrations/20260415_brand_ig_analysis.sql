-- ============================================================
-- Phase: Brand Instagram Content Analysis + Semantic Matching
-- ------------------------------------------------------------
-- Adds schema for the CIP pipeline to analyze the BRAND's own
-- Instagram content (not just creators'), plus content embeddings
-- on both brands and creators for pgvector cosine similarity.
-- Extends background_jobs with two new job types used during
-- onboarding fanout.
-- ============================================================

-- pgvector is already enabled by 20260411_vector_search.sql but keep idempotent
CREATE EXTENSION IF NOT EXISTS vector;

-- ── brands: IG analysis columns + content embedding ──────────

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS ig_analysis_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ig_analysis_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ig_analysis_error text,
  ADD COLUMN IF NOT EXISTS ig_content_dna jsonb,
  ADD COLUMN IF NOT EXISTS ig_audience_profile jsonb,
  ADD COLUMN IF NOT EXISTS ig_collaborators text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_computed_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brands_ig_analysis_status_check'
  ) THEN
    ALTER TABLE brands DROP CONSTRAINT brands_ig_analysis_status_check;
  END IF;
END $$;

ALTER TABLE brands
  ADD CONSTRAINT brands_ig_analysis_status_check
  CHECK (ig_analysis_status IN ('none','queued','running','completed','failed'));

-- ── creators: content embedding for semantic matching ────────

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS content_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_computed_at timestamptz;

-- ── HNSW indexes for cosine similarity ───────────────────────
-- Using HNSW for better recall/latency on small-to-medium pools
-- (agent_episodes uses IVFFlat which requires training on existing
-- rows; HNSW works well on empty-then-growing tables during rollout).

CREATE INDEX IF NOT EXISTS idx_brands_content_embedding
  ON brands USING hnsw (content_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_creators_content_embedding
  ON creators USING hnsw (content_embedding vector_cosine_ops);

-- ── Extend background_jobs.job_type CHECK ────────────────────

ALTER TABLE background_jobs DROP CONSTRAINT IF EXISTS background_jobs_job_type_check;
ALTER TABLE background_jobs
  ADD CONSTRAINT background_jobs_job_type_check
  CHECK (job_type IN (
    'shopify_sync',
    'brand_matching',
    'brand_ig_scrape',
    'creator_ig_scrape'
  ));

-- ── creator_brand_matches: expose score breakdown for tuning ──

ALTER TABLE creator_brand_matches
  ADD COLUMN IF NOT EXISTS match_score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS used_ig_signals boolean NOT NULL DEFAULT false;

-- ── RPC: find creators most similar to a given embedding ─────
-- Mirrors fn_search_knowledge_by_embedding style (20260411).
-- No brand_id scope — creators are shared across brands.

CREATE OR REPLACE FUNCTION fn_find_similar_creators(
  p_embedding vector(1536),
  p_limit int DEFAULT 50,
  p_min_similarity float DEFAULT 0.3,
  p_exclude_ids uuid[] DEFAULT '{}'
)
RETURNS TABLE (
  creator_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    (1 - (c.content_embedding <=> p_embedding))::float AS similarity
  FROM creators c
  WHERE c.content_embedding IS NOT NULL
    AND (1 - (c.content_embedding <=> p_embedding)) >= p_min_similarity
    AND NOT (c.id = ANY(p_exclude_ids))
  ORDER BY c.content_embedding <=> p_embedding ASC
  LIMIT p_limit;
END;
$$;

-- ── RPC: resolve past-collaborator creator IDs for a brand ───
-- Takes brands.ig_collaborators (text[] of handles) and returns
-- matching creator rows (those we've CIP'd). Used by the scorer
-- to pre-fetch past-collab embeddings.

CREATE OR REPLACE FUNCTION fn_resolve_brand_past_collaborators(
  p_brand_id uuid
)
RETURNS TABLE (
  creator_id uuid,
  handle text,
  content_embedding vector(1536)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_handles text[];
BEGIN
  SELECT ig_collaborators INTO v_handles FROM brands WHERE id = p_brand_id;
  IF v_handles IS NULL OR array_length(v_handles, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.handle, c.content_embedding
  FROM creators c
  WHERE c.handle = ANY(v_handles);
END;
$$;

-- ── pg_cron: drive the pipeline worker ───────────────────────
-- The cron extension ships with Supabase but needs explicit opt-in.
-- We register the schedules only if pg_cron is installed; otherwise
-- the migration succeeds and the operator sets up cron out-of-band.
--
-- Required GUCs (set via Supabase dashboard → Database → Settings):
--   app.settings.pipeline_worker_url  = 'https://<host>/process-next-job'
--   app.settings.pipeline_worker_secret = '<shared-secret>'
--
-- Cadence:
--   pipeline-worker-tick    → every 30s; fires /process-next-job
--   pipeline-worker-recover → every 5m;  fires /recover-stale-jobs

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule prior versions if the migration is re-run
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('pipeline-worker-tick', 'pipeline-worker-recover');

    PERFORM cron.schedule(
      'pipeline-worker-tick',
      '30 seconds',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.settings.pipeline_worker_url', true),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Worker-Secret', current_setting('app.settings.pipeline_worker_secret', true)
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 1000
        );
      $cron$
    );

    PERFORM cron.schedule(
      'pipeline-worker-recover',
      '*/5 * * * *',
      $cron$
        SELECT net.http_post(
          url := replace(
            current_setting('app.settings.pipeline_worker_url', true),
            '/process-next-job',
            '/recover-stale-jobs'
          ),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Worker-Secret', current_setting('app.settings.pipeline_worker_secret', true)
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 5000
        );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension is not enabled; skipping pipeline worker schedules. Enable pg_cron and re-run the DO block manually, or set up external cron.';
  END IF;
END $$;

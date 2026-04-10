-- ============================================================
-- Phase 6B.1: Structured execution traces for agent observability
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_chat_sessions(id) ON DELETE SET NULL,

  trace_type TEXT NOT NULL CHECK (trace_type IN (
    'llm_call', 'tool_call', 'tool_result', 'tool_error',
    'memory_retrieval', 'approval_created', 'approval_resolved',
    'embedding_generated', 'knowledge_written'
  )),

  step_number INT DEFAULT 0,
  tool_name TEXT,
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  error TEXT,

  duration_ms INT,
  tokens_used INT,
  cost_cents NUMERIC(10,4),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying traces by brand and session
CREATE INDEX IF NOT EXISTS idx_agent_traces_brand_session
  ON agent_traces (brand_id, session_id, created_at DESC);

-- Index for aggregating by tool name
CREATE INDEX IF NOT EXISTS idx_agent_traces_tool
  ON agent_traces (brand_id, tool_name, created_at DESC)
  WHERE tool_name IS NOT NULL;

-- Auto-delete traces older than 90 days (keep storage manageable)
-- This can be run as a cron job
CREATE OR REPLACE FUNCTION fn_cleanup_old_traces()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM agent_traces WHERE created_at < now() - interval '90 days';
$$;

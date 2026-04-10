-- ============================================================
-- Phase 6D.1: Durable workflow state machine for multi-step tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_chat_sessions(id) ON DELETE SET NULL,

  workflow_type TEXT NOT NULL CHECK (workflow_type IN (
    'campaign_creation', 'bulk_outreach', 'bulk_discount_codes',
    'campaign_report', 'creator_analysis', 'custom'
  )),

  title TEXT NOT NULL,
  current_step INT NOT NULL DEFAULT 0,
  total_steps INT NOT NULL DEFAULT 1,

  -- Full workflow state persisted as JSON
  state JSONB NOT NULL DEFAULT '{}',

  -- Step definitions: [{ name, status, input, output, error }]
  steps JSONB NOT NULL DEFAULT '[]',

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'paused', 'failed', 'completed', 'cancelled'
  )),

  error TEXT,
  error_at_step INT,
  retry_count INT DEFAULT 0,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_workflows_brand_status
  ON agent_workflows (brand_id, status, created_at DESC);

-- Chat sessions: each session groups a set of agent_conversations messages
CREATE TABLE IF NOT EXISTS agent_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_brand
  ON agent_chat_sessions(brand_id, updated_at DESC);

-- Add session_id to agent_conversations (nullable for backward compat with existing rows)
ALTER TABLE agent_conversations
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES agent_chat_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_conversations_session
  ON agent_conversations(session_id, created_at ASC);

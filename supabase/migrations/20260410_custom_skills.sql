-- Custom Skills: User-defined tools that the agent can use
-- Supports three execution types: prompt (LLM sub-call), api (HTTP), query (Supabase)

CREATE TABLE IF NOT EXISTS custom_skills (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name             text NOT NULL,              -- tool key the LLM sees, e.g. "analyze_creator_style"
  label            text NOT NULL,              -- Human-readable label
  description      text NOT NULL,              -- Description Claude uses for routing
  category         text NOT NULL DEFAULT 'custom',
  input_schema     jsonb NOT NULL DEFAULT '{"type":"object","properties":{}}',  -- JSON Schema for parameters
  execution_type   text NOT NULL DEFAULT 'prompt',  -- 'prompt' | 'api' | 'query'
  execution_config jsonb NOT NULL DEFAULT '{}',     -- Type-specific execution config
  risk_level       text NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high'
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_skills_brand_name_unique UNIQUE (brand_id, name),
  CONSTRAINT custom_skills_execution_type_check CHECK (execution_type IN ('prompt', 'api', 'query')),
  CONSTRAINT custom_skills_risk_level_check CHECK (risk_level IN ('low', 'medium', 'high'))
);

-- Index for fast brand lookups
CREATE INDEX IF NOT EXISTS idx_custom_skills_brand_id ON custom_skills(brand_id);
CREATE INDEX IF NOT EXISTS idx_custom_skills_active ON custom_skills(brand_id, is_active);

-- RLS
ALTER TABLE custom_skills ENABLE ROW LEVEL SECURITY;

-- Brand owners can see/manage their own custom skills
CREATE POLICY "Users can view own custom skills"
  ON custom_skills FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create own custom skills"
  ON custom_skills FOR INSERT
  WITH CHECK (brand_id IN (SELECT id FROM brands WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own custom skills"
  ON custom_skills FOR UPDATE
  USING (brand_id IN (SELECT id FROM brands WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own custom skills"
  ON custom_skills FOR DELETE
  USING (brand_id IN (SELECT id FROM brands WHERE auth_user_id = auth.uid()));

-- Service role can access all (for agent runtime)
CREATE POLICY "Service role full access to custom skills"
  ON custom_skills FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_custom_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_skills_updated_at
  BEFORE UPDATE ON custom_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_skills_updated_at();

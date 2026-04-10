-- Add per-skill disable capability to agent_config
-- Skills are enabled by default (empty array = all enabled).
-- When a skill name is in this array, it's disabled even if its permission group is on.
ALTER TABLE agent_config
  ADD COLUMN IF NOT EXISTS disabled_skills jsonb DEFAULT '[]'::jsonb;

-- Validate it's always an array
ALTER TABLE agent_config
  ADD CONSTRAINT chk_disabled_skills_is_array
  CHECK (jsonb_typeof(disabled_skills) = 'array');

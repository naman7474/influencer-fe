-- Brand Safety / Brand-Creator Matching Score
-- Adds brand identity columns and brand_guidelines table

-- 1. New columns on brands table
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS brand_description text,
  ADD COLUMN IF NOT EXISTS brand_values text[],
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS brand_voice_preference content_tone,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS min_audience_age integer;

-- 2. Brand guidelines table
CREATE TABLE IF NOT EXISTS brand_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  forbidden_topics text[] DEFAULT '{}',
  content_dos text[] DEFAULT '{}',
  content_donts text[] DEFAULT '{}',
  required_disclosures text[] DEFAULT '{}',
  preferred_content_themes text[] DEFAULT '{}',
  content_rating text DEFAULT 'general',
  require_paid_partnership_label boolean DEFAULT true,
  max_sponsored_post_rate numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_id)
);

ALTER TABLE brand_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owner can manage own guidelines"
  ON brand_guidelines FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE auth_user_id = auth.uid()));

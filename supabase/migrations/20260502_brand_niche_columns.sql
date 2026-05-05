-- Brand niche classification (primary/secondary) inferred at IG-analyze
-- time so the matcher's computeNicheFit can compare brand niche against
-- creator caption_intelligence.primary_niche on the SAME 12-niche enum
-- (mirrors pipeline/llm_captions.py CAPTION_NICHES).
--
-- Until populated, computeNicheFit falls back to brands.product_categories
-- (legacy path), so existing brands keep working — re-running brand IG
-- analysis populates the columns and the engine prefers them.

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS primary_niche text,
  ADD COLUMN IF NOT EXISTS secondary_niche text,
  ADD COLUMN IF NOT EXISTS niche_classified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_brands_primary_niche
  ON brands (primary_niche)
  WHERE primary_niche IS NOT NULL;

COMMENT ON COLUMN brands.primary_niche IS
  'LLM-classified primary niche from the 12-niche enum (beauty/fashion/lifestyle/tech/food/fitness/travel/education/entertainment/parenting/health/finance). Populated by handle_brand_ig_scrape.';

COMMENT ON COLUMN brands.secondary_niche IS
  'LLM-classified secondary niche from the same enum, or NULL if mono-niche brand.';

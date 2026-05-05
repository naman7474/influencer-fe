-- Synthetic geo rows for brands that haven't connected Shopify.
--
-- Without Shopify, brand_shopify_geo is empty for the brand →
-- v_brand_geo_gaps returns no rows → matching engine's audience_geo
-- floors at 0.3, capping the composite at 35-45% even for a perfectly
-- niche-matched creator. We synthesize state-level rows from the
-- onboarding signals we DO have (shipping_zones, target_regions, the
-- brand's own IG audience profile) so the matcher can produce real
-- audience_geo scores while flagging the synthetic origin.
--
-- Design:
--   1. Add `source` column ('shopify' | 'synthetic'). Existing rows backfill
--      to 'shopify'.
--   2. Replace the existing unique index with one that admits both a
--      shopify row and a synthetic row per (brand, city, state) — synthetic
--      acts as a bootstrap that real Shopify data overwrites later.
--   3. Update v_brand_geo_gaps to deduplicate (city,state) per brand, picking
--      shopify over synthetic. The downstream column shape is unchanged so
--      engine.ts:1055-1099 keeps reading from the same view.

ALTER TABLE brand_shopify_geo
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'shopify'
    CHECK (source IN ('shopify', 'synthetic'));

COMMENT ON COLUMN brand_shopify_geo.source IS
  'Where this row came from. shopify = real Storefront Analytics ingest. '
  'synthetic = derived at brand_ig_scrape time from shipping_zones, '
  'target_regions, and ig_audience_profile when Shopify is not connected.';

-- Replace the location uniqueness with one that includes source. This lets
-- a brand have BOTH a shopify row AND a synthetic row at the same location;
-- the view picks one. Without this, the synthetic upsert would clobber a
-- real Shopify row (or vice versa) on the next refresh.
DROP INDEX IF EXISTS uq_brand_shopify_geo_location;
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_shopify_geo_location_src
  ON brand_shopify_geo (
    brand_id,
    lower(coalesce(city, '')),
    lower(coalesce(state, '')),
    source
  );

-- Rebuild v_brand_geo_gaps to deduplicate per (brand, city, state),
-- preferring source='shopify' when both exist. Only one row per location
-- flows downstream, so the engine's per-state gap aggregation
-- (engine.ts:1081-1099) doesn't double-count.
CREATE OR REPLACE VIEW v_brand_geo_gaps AS
WITH ranked AS (
  SELECT
    g.*,
    row_number() OVER (
      PARTITION BY g.brand_id, lower(coalesce(g.city, '')), lower(coalesce(g.state, ''))
      ORDER BY CASE g.source WHEN 'shopify' THEN 0 ELSE 1 END,
               g.refreshed_at DESC
    ) AS rn
  FROM brand_shopify_geo g
),
deduped AS (
  SELECT * FROM ranked WHERE rn = 1
),
totals AS (
  SELECT
    brand_id,
    SUM(orders)   AS total_orders,
    SUM(sessions) AS total_sessions,
    SUM(revenue)  AS total_revenue,
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY CASE WHEN sessions > 0 THEN orders::float / sessions END
    ) AS median_cr
  FROM deduped
  GROUP BY brand_id
)
-- Column order matches migration 042 exactly so CREATE OR REPLACE works
-- without dropping the view (Postgres rejects positional changes).
-- New columns (`source`) appended at the end.
SELECT
  g.brand_id,
  g.state,
  g.city,
  g.country,
  g.orders,
  g.sessions,
  g.revenue,
  g.population_weight AS pop_weight,
  g.gap_score,
  CASE WHEN t.total_sessions > 0
       THEN g.sessions::float / t.total_sessions END         AS session_share,
  g.orders::float  / NULLIF(t.total_orders, 0)               AS order_share,
  g.revenue::float / NULLIF(t.total_revenue, 0)              AS revenue_share,
  CASE WHEN g.sessions > 0
       THEN g.orders::float / g.sessions END                 AS conversion_rate,
  t.median_cr                                                AS brand_median_cr,
  CASE
    WHEN g.source = 'synthetic' THEN
      -- Synthetic rows are pre-classified by the IG handler; trust the
      -- problem_type that was written. (Sessions/orders are zero for
      -- synthetic, so the sessions-aware logic below would mis-classify.)
      coalesce(g.problem_type, 'awareness_gap')
    WHEN b.shopify_geo_sessions_available THEN
      CASE
        WHEN g.population_weight >= 0.1
             AND g.sessions::float / NULLIF(t.total_sessions, 0)
                 < g.population_weight * 0.3
          THEN 'awareness_gap'
        WHEN g.sessions::float / NULLIF(t.total_sessions, 0)
             >= g.population_weight * 0.5
             AND g.sessions > 0
             AND g.orders::float / g.sessions < t.median_cr * 0.6
          THEN 'conversion_gap'
        WHEN g.sessions::float / NULLIF(t.total_sessions, 0)
             >= g.population_weight * 0.5
             AND g.sessions > 0
             AND g.orders::float / g.sessions >= t.median_cr * 0.8
          THEN 'strong_market'
        ELSE 'untracked'
      END
    ELSE
      CASE
        WHEN g.population_weight >= 0.1
             AND g.orders::float / NULLIF(t.total_orders, 0)
                 < g.population_weight * 0.3
          THEN 'awareness_gap'
        WHEN g.orders::float / NULLIF(t.total_orders, 0)
             >= g.population_weight * 0.5
          THEN 'strong_market'
        ELSE 'untracked'
      END
  END AS problem_type_current,
  g.source                                                   AS source
FROM deduped g
JOIN totals t ON t.brand_id = g.brand_id
JOIN brands b ON b.id       = g.brand_id;

COMMENT ON VIEW v_brand_geo_gaps IS
  'Per-brand state-level gap classification recomputed on read. '
  'Deduplicates rows per (brand, city, state) preferring source=shopify '
  'over source=synthetic. Read by the matching engine (computeAudienceGeo); '
  'do not trust brand_shopify_geo.problem_type directly — it may be stale.';

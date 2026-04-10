-- ============================================================
-- Migration: adds only genuinely missing columns and indexes
-- that are referenced by agent tools, API routes, and webhooks
-- but not present in the main supabase/migrations/ directory.
--
-- Safe to re-run (IF NOT EXISTS throughout).
-- ============================================================

-- ─── 1. campaign_creators: brand_id for quick brand filtering ──
-- Used by approval handler when adding creators to a new campaign.
ALTER TABLE campaign_creators
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE CASCADE;

-- ─── 2. campaign_performance_summary: creator_id ───────────────
-- Tools (roi-calculator, campaign-reporter) need creator_id to
-- join with mv_creator_leaderboard. The actual table only has
-- campaign_creator_id (NOT NULL). Adding creator_id as nullable
-- for direct lookups.
ALTER TABLE campaign_performance_summary
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES creators(id) ON DELETE SET NULL;

-- Backfill creator_id from campaign_creators
UPDATE campaign_performance_summary ps
SET creator_id = cc.creator_id
FROM campaign_creators cc
WHERE ps.campaign_creator_id = cc.id
  AND ps.creator_id IS NULL;

-- ─── 3. campaign_reports: unique index for upsert ──────────────
-- campaign-reporter tool does .upsert(…, { onConflict: "campaign_id,report_type" })
-- but migration 026 only created non-unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_reports_unique
  ON campaign_reports(campaign_id, report_type);

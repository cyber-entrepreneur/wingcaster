-- BE-BLOCKER-24 + BE-BLOCKER-25 / Week 5 Agent 1
-- File: 335_report_expires_at.sql
--
-- Note: migration 316 was already taken on main (316_wave0_nav_user_prefs.sql).
-- This is the next free number ≥316 at branch time.
--
-- Adds expires_at to both report tables, backfills pending-like rows to
-- created_at + 30 days, allows status='expired', and indexes the sweeper path.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- comparable_reports
-- ---------------------------------------------------------------------------
ALTER TABLE market_pricing.comparable_reports
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE market_pricing.comparable_reports
  ALTER COLUMN expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days');

UPDATE market_pricing.comparable_reports
   SET expires_at = COALESCE(created_at, CURRENT_TIMESTAMP) + INTERVAL '30 days'
 WHERE expires_at IS NULL
   AND status IN ('pending', 'pending_review');

ALTER TABLE market_pricing.comparable_reports
  DROP CONSTRAINT IF EXISTS comparable_reports_status_check;

ALTER TABLE market_pricing.comparable_reports
  ADD CONSTRAINT comparable_reports_status_check
  CHECK (status IS NULL OR status IN (
    'pending',
    'pending_review',
    'reviewed',
    'dismissed',
    'actioned',
    'expired'
  ));

CREATE INDEX IF NOT EXISTS idx_comparable_reports_pending_expires_at
  ON market_pricing.comparable_reports (status, expires_at)
  WHERE status IN ('pending', 'pending_review');

-- ---------------------------------------------------------------------------
-- agent_price_reports
-- ---------------------------------------------------------------------------
ALTER TABLE market_pricing.agent_price_reports
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE market_pricing.agent_price_reports
  ALTER COLUMN expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days');

UPDATE market_pricing.agent_price_reports
   SET expires_at = COALESCE(created_at, CURRENT_TIMESTAMP) + INTERVAL '30 days'
 WHERE expires_at IS NULL
   AND status IN ('pending', 'pending_review');

ALTER TABLE market_pricing.agent_price_reports
  DROP CONSTRAINT IF EXISTS agent_price_reports_status_check;

ALTER TABLE market_pricing.agent_price_reports
  ADD CONSTRAINT agent_price_reports_status_check
  CHECK (status IS NULL OR status IN (
    'pending',
    'pending_review',
    'verified',
    'rejected',
    'expired'
  ));

CREATE INDEX IF NOT EXISTS idx_agent_price_reports_pending_expires_at
  ON market_pricing.agent_price_reports (status, expires_at)
  WHERE status IN ('pending', 'pending_review');

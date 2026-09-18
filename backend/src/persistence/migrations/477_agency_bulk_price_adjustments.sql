-- AGN-PRC-002 — Agency bulk price adjustments with reversal window.
--
-- Each batch captures the before/after price for every affected listing so an
-- owner/admin can undo the entire operation atomically during the reversal
-- window (default 24 hours). After the deadline the batch is committed.

CREATE TABLE IF NOT EXISTS agency_bulk_price_adjustments (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  strategy TEXT NOT NULL,
  strategy_value NUMERIC(12, 4),
  reversal_hours INTEGER NOT NULL DEFAULT 24,
  reversal_deadline_at TIMESTAMPTZ NOT NULL,
  listing_count INTEGER NOT NULL DEFAULT 0,
  total_value_before NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_value_after NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reverted_at TIMESTAMPTZ,
  reverted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT agency_bulk_price_adjustments_status_check
    CHECK (status IN ('active', 'committed', 'reverted', 'cancelled')),
  CONSTRAINT agency_bulk_price_adjustments_strategy_check
    CHECK (strategy IN ('recommendation', 'percent_up', 'percent_down', 'set_median', 'fixed_delta')),
  CONSTRAINT agency_bulk_price_adjustments_reversal_hours_check
    CHECK (reversal_hours BETWEEN 1 AND 168)
);

CREATE TABLE IF NOT EXISTS agency_bulk_price_adjustment_items (
  id TEXT PRIMARY KEY,
  adjustment_id TEXT NOT NULL REFERENCES agency_bulk_price_adjustments(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  agent_id TEXT,
  title TEXT,
  address TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_before NUMERIC(12, 2) NOT NULL,
  price_after NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT agency_bulk_price_adjustment_items_unique
    UNIQUE (adjustment_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_bulk_price_adjustments_agency_status
  ON agency_bulk_price_adjustments(agency_id, status, reversal_deadline_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_bulk_price_adjustment_items_adjustment
  ON agency_bulk_price_adjustment_items(adjustment_id);

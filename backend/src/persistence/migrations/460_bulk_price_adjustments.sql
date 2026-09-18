-- AGN-PRC-002 — Agency bulk price adjustment with a reversal window.
--
-- An agency Owner/Admin adjusts many listings' asking prices in one
-- operation (percent up/down, fixed delta, or set-to-comparables-median).
-- Every batch records:
--   * a summary row (bulk_price_adjustments) with strategy, affected
--     count, aggregate value before/after, and a reversal deadline;
--   * one item row per affected listing (bulk_price_adjustment_items)
--     capturing the exact old_price so an Undo can restore every price
--     atomically.
--
-- Reversal window: while `status = 'applied'` and NOW() < reversal_deadline
-- the batch can be undone with one action; after the deadline the change is
-- committed and only reversible via a new manual adjustment. No background
-- job is required — the window is enforced by comparing NOW() to the stored
-- deadline at Undo time.
--
-- These are LISTING (real-estate asking price) changes, not billing.

CREATE TABLE IF NOT EXISTS market_pricing.bulk_price_adjustments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES public.users(id),
  strategy VARCHAR(20) NOT NULL
    CHECK (strategy IN ('percent_up', 'percent_down', 'fixed_delta', 'set_to_median')),
  listing_count INTEGER NOT NULL DEFAULT 0,
  total_value_before NUMERIC(18,2),
  total_value_after NUMERIC(18,2),
  currency VARCHAR(10),
  status VARCHAR(20) NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied', 'reverted')),
  reversal_deadline TIMESTAMPTZ,
  reverted_at TIMESTAMPTZ,
  reverted_by TEXT REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bulk_price_adjustments_agency
  ON market_pricing.bulk_price_adjustments(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_price_adjustments_active
  ON market_pricing.bulk_price_adjustments(agency_id, status, reversal_deadline);

CREATE TABLE IF NOT EXISTS market_pricing.bulk_price_adjustment_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  batch_id TEXT NOT NULL
    REFERENCES market_pricing.bulk_price_adjustments(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id TEXT,
  old_price NUMERIC(15,2),
  new_price NUMERIC(15,2),
  currency VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bulk_price_adjustment_items_batch
  ON market_pricing.bulk_price_adjustment_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_bulk_price_adjustment_items_property
  ON market_pricing.bulk_price_adjustment_items(property_id, created_at DESC);

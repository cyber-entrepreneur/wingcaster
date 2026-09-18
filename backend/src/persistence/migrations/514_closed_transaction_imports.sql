-- AGT-HTX-003 — Import closed transactions (CSV backfill).
--
-- Promotes closed_transactions from legacy_collections into a typed table
-- and records each CSV import batch for audit / support.

CREATE TABLE IF NOT EXISTS closed_transactions (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agency_id TEXT,
  contact_id TEXT,
  opportunity_id TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'sale',
  original_listed_price NUMERIC(14, 2),
  final_sold_price NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  price_reductions_count INTEGER,
  price_reduction_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  listed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ NOT NULL,
  days_on_market INTEGER,
  days_to_first_offer INTEGER,
  offers_received_count INTEGER,
  viewings_conducted INTEGER,
  rejected_offer_max NUMERIC(14, 2),
  rejected_offer_min NUMERIC(14, 2),
  buyer_type TEXT NOT NULL DEFAULT 'unknown',
  buyer_nationality TEXT,
  payment_method TEXT NOT NULL DEFAULT 'unknown',
  down_payment_percent NUMERIC(5, 2),
  mortgage_provider TEXT,
  close_reason TEXT NOT NULL DEFAULT 'other',
  agent_notes TEXT,
  attribution_source TEXT NOT NULL DEFAULT 'other',
  origin TEXT NOT NULL DEFAULT 'agent_form',
  is_backfilled BOOLEAN NOT NULL DEFAULT FALSE,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT closed_transactions_type_check
    CHECK (transaction_type IN ('sale', 'rent', 'lease')),
  CONSTRAINT closed_transactions_buyer_type_check
    CHECK (buyer_type IN ('owner_occupier', 'investor', 'corporate', 'international', 'unknown')),
  CONSTRAINT closed_transactions_payment_check
    CHECK (payment_method IN ('cash', 'mortgage', 'installments', 'off_plan_payment_plan', 'other', 'unknown')),
  CONSTRAINT closed_transactions_attribution_check
    CHECK (attribution_source IN ('own_client', 'referral', 'walkin', 'portal_lead', 'social_lead', 'past_client', 'other')),
  CONSTRAINT closed_transactions_close_reason_check
    CHECK (close_reason IN ('market_price', 'price_reduction', 'urgent_seller', 'urgent_buyer', 'family_transfer', 'inheritance', 'relocation', 'developer_deal', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_closed_transactions_agent_closed
  ON closed_transactions(agent_id, closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_closed_transactions_listing
  ON closed_transactions(listing_id, closed_at DESC);

CREATE TABLE IF NOT EXISTS closed_transaction_imports (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agency_id TEXT,
  filename TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_closed_transaction_imports_agent
  ON closed_transaction_imports(agent_id, created_at DESC);

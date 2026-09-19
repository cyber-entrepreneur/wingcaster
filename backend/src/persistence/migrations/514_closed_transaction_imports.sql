-- AGT-HTX-003 — Import closed transactions (CSV backfill).
--
-- Additive against 465_revenue_attribution.sql (AGN-REP-007, PR #264):
-- if public.closed_transactions already exists from 465, only ALTER / index;
-- never assume this migration's CREATE TABLE is the definition that ran.

-- Fallback when 514 applies before 465 (out-of-order lane merge).
CREATE TABLE IF NOT EXISTS public.closed_transactions (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agency_id TEXT,
  contact_id TEXT,
  opportunity_id TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'sale',
  original_listed_price NUMERIC(15, 2),
  final_sold_price NUMERIC(15, 2),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  price_reductions_count INTEGER,
  price_reduction_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  listed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ NOT NULL,
  days_on_market INTEGER,
  days_to_first_offer INTEGER,
  offers_received_count INTEGER,
  viewings_conducted INTEGER,
  rejected_offer_max NUMERIC(15, 2),
  rejected_offer_min NUMERIC(15, 2),
  buyer_type TEXT NOT NULL DEFAULT 'unknown',
  buyer_nationality TEXT,
  payment_method TEXT NOT NULL DEFAULT 'unknown',
  down_payment_percent NUMERIC(5, 2),
  mortgage_provider TEXT,
  close_reason TEXT NOT NULL DEFAULT 'other',
  agent_notes TEXT NOT NULL DEFAULT '',
  attribution_source TEXT NOT NULL DEFAULT 'other',
  origin TEXT NOT NULL DEFAULT 'agent_form',
  is_backfilled BOOLEAN NOT NULL DEFAULT false,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 465 omits this column; required by closed-transactions.js CSV import.
ALTER TABLE public.closed_transactions
  ADD COLUMN IF NOT EXISTS price_reduction_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Idempotent CHECK constraints (465 does not define these).
DO $$ BEGIN
  ALTER TABLE public.closed_transactions
    ADD CONSTRAINT closed_transactions_type_check
    CHECK (transaction_type IN ('sale', 'rent', 'lease'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.closed_transactions
    ADD CONSTRAINT closed_transactions_buyer_type_check
    CHECK (buyer_type IN ('owner_occupier', 'investor', 'corporate', 'international', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.closed_transactions
    ADD CONSTRAINT closed_transactions_payment_check
    CHECK (payment_method IN ('cash', 'mortgage', 'installments', 'off_plan_payment_plan', 'other', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.closed_transactions
    ADD CONSTRAINT closed_transactions_attribution_check
    CHECK (attribution_source IN ('own_client', 'referral', 'walkin', 'portal_lead', 'social_lead', 'past_client', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.closed_transactions
    ADD CONSTRAINT closed_transactions_close_reason_check
    CHECK (close_reason IN ('market_price', 'price_reduction', 'urgent_seller', 'urgent_buyer', 'family_transfer', 'inheritance', 'relocation', 'developer_deal', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Agent list / import hot paths (465 adds agency-scoped indexes only).
CREATE INDEX IF NOT EXISTS idx_closed_transactions_agent_closed
  ON public.closed_transactions(agent_id, closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_closed_transactions_listing
  ON public.closed_transactions(listing_id, closed_at DESC);

-- Owned by AGT-HTX-003 — CSV import audit batches.
CREATE TABLE IF NOT EXISTS public.closed_transaction_imports (
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
  ON public.closed_transaction_imports(agent_id, created_at DESC);

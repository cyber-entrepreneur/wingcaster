-- AGN-REP-007 — closed_transactions persistence + revenue attribution indexes.
-- The collection was used by closed-transactions.js but lacked a dedicated table.

CREATE TABLE IF NOT EXISTS public.closed_transactions (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES public.agents(id) ON DELETE SET NULL,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'sale',
  original_listed_price NUMERIC(15, 2),
  final_sold_price NUMERIC(15, 2),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  price_reductions_count INTEGER,
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

CREATE INDEX IF NOT EXISTS idx_closed_transactions_agency_closed_at
  ON public.closed_transactions(agency_id, closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_closed_transactions_agency_attribution
  ON public.closed_transactions(agency_id, attribution_source);

CREATE INDEX IF NOT EXISTS idx_closed_transactions_agency_agent
  ON public.closed_transactions(agency_id, agent_id);

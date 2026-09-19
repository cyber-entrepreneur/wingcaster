-- AGN-CRD-001 — Agency wallet alert threshold settings (per-agency).
-- IDs are TEXT to match public.agencies / public.users (002_identity_org).

CREATE TABLE IF NOT EXISTS public.agency_credit_wallet_settings (
  agency_id TEXT PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  low_balance_alert_threshold NUMERIC(12, 2) NOT NULL DEFAULT 100
    CHECK (low_balance_alert_threshold >= 0),
  updated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_credit_wallet_settings_updated_at
  ON public.agency_credit_wallet_settings (updated_at DESC);

COMMENT ON TABLE public.agency_credit_wallet_settings IS
  'Per-agency wallet UI settings (low-balance alert threshold for AGN-CRD-001).';

-- AGT-LST-015 — seller performance report configuration + share tokens.

CREATE TABLE IF NOT EXISTS public.seller_reports (
  id UUID PRIMARY KEY,
  property_id TEXT NOT NULL UNIQUE,
  agent_id TEXT NOT NULL,
  agency_id TEXT,
  state_of_play TEXT,
  agent_summary TEXT,
  show_offer_amounts BOOLEAN NOT NULL DEFAULT FALSE,
  show_full_address BOOLEAN NOT NULL DEFAULT FALSE,
  layout_template TEXT NOT NULL DEFAULT 'standard'
    CHECK (layout_template IN ('standard', 'compact', 'executive')),
  status TEXT NOT NULL DEFAULT 'live'
    CHECK (status IN ('live', 'frozen', 'revoked')),
  frozen_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seller_report_share_tokens (
  id UUID PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.seller_reports(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  recipient_email TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_reports_agent
  ON public.seller_reports (agent_id);

CREATE INDEX IF NOT EXISTS idx_seller_report_share_tokens_report
  ON public.seller_report_share_tokens (report_id);

CREATE INDEX IF NOT EXISTS idx_seller_report_share_tokens_active_token
  ON public.seller_report_share_tokens (token)
  WHERE revoked_at IS NULL;

-- Per-user daily AI suggestion counters + per-agency-member cap overrides.
-- IDs are TEXT to match public.users / public.agencies (002_identity_org).

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  tenant_id TEXT NOT NULL,
  suggestions_used INTEGER NOT NULL DEFAULT 0 CHECK (suggestions_used >= 0),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  last_call_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_tenant_date
  ON public.ai_usage_daily (tenant_id, usage_date DESC);

CREATE TABLE IF NOT EXISTS public.agency_ai_settings (
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  daily_cap INTEGER NOT NULL DEFAULT 200 CHECK (daily_cap >= 1),
  monthly_cap INTEGER CHECK (monthly_cap IS NULL OR monthly_cap >= 1),
  set_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_ai_settings_user
  ON public.agency_ai_settings (user_id);

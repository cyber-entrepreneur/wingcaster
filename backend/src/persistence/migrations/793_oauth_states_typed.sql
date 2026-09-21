-- PR0 — typed oauth_states table (OAuth 2.0 unification schema-only tranche).
-- RLS deferred to PR6. `data` + `updated_at` required by persistence DAL (table-mapper).

CREATE TABLE IF NOT EXISTS public.oauth_states (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  code_verifier_encrypted TEXT,
  redirect_uri TEXT,
  return_to TEXT,
  elevated BOOLEAN NOT NULL DEFAULT FALSE,
  nonce TEXT,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_platform
  ON public.oauth_states (platform);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at
  ON public.oauth_states (expires_at);

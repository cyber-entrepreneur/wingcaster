-- 800 — Meta (Facebook/Instagram/WhatsApp) data-deletion + deauthorize request log.
-- Required for Meta app review: the Data Deletion Request callback returns a status
-- URL the user can check. This row IS that status record.
--
-- Global, NOT tenant-RLS: a Meta app-scoped user id spans tenants and the request
-- arrives from an unauthenticated Meta webhook (verified by signed_request HMAC).
-- It holds no tenant data — only a pseudonymous provider user id + an unguessable
-- confirmation code — so it is read only via that code, never via a tenant API.

CREATE TABLE IF NOT EXISTS public.oauth_data_deletion_requests (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'meta',
  provider_user_id TEXT,
  confirmation_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  connections_scrubbed INTEGER NOT NULL DEFAULT 0,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_data_deletion_confirmation
  ON public.oauth_data_deletion_requests (confirmation_code);

CREATE INDEX IF NOT EXISTS idx_oauth_data_deletion_provider_user
  ON public.oauth_data_deletion_requests (provider, provider_user_id);

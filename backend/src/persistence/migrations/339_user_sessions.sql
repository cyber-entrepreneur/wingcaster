-- SHR-SET-004 / Wave 4B — per-session tracking for Sessions & devices.
--
-- Auth remains a signed JWT bound to users.token_version (global eject on
-- password change / 2FA disable). That bump cannot revoke a *single* session,
-- so each issued login also inserts a row here and puts the row id on the
-- JWT as `session_id` (and `jti`). Middleware rejects a token whose row is
-- revoked; last_active_at is touched on a throttled cadence, not every request.
--
-- ip_city / ip_country are nullable. There is no geo-IP lookup in this
-- migration: callers store null when a lookup is unavailable. Do not fake
-- locations.

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jwt_jti TEXT NOT NULL UNIQUE,
  device_summary TEXT NOT NULL,
  device_kind TEXT NOT NULL CHECK (device_kind IN ('desktop', 'mobile', 'tablet', 'unknown')),
  ip TEXT,
  ip_country_iso TEXT,
  ip_country TEXT,
  ip_city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
  ON public.user_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_jti
  ON public.user_sessions (jwt_jti);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON public.user_sessions (user_id)
  WHERE revoked_at IS NULL;

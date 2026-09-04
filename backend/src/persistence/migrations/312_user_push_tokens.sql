-- Device tokens for consumer push dispatch (FCM).
--
-- Numbering: 307/308/309 are PART1 notifications, 310 is property_ai_ratings,
-- 311 is reserved for vendor-admin PR #44. Lettered NNN[a-z]_ files are
-- operator-only and skipped by runner.js — this file stays numeric.
--
-- UNIQUE(token) is global: a device token maps to ONE user at a time.
-- Re-registering the same token (shared tablet / kiosk / re-login) evicts
-- the previous user_id rather than delivering to both.

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token TEXT NOT NULL,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ,
  CONSTRAINT user_push_tokens_token_key UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user
  ON public.user_push_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_platform
  ON public.user_push_tokens (platform);

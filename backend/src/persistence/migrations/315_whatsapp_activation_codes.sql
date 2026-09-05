-- Model B WhatsApp intake: expiring activation codes (H1, H6).
--
-- Unique-index note: Postgres rejects `expires_at > NOW()` in a partial unique
-- index (NOW() is STABLE, not IMMUTABLE). Uniqueness of live codes is
-- `claimed_at IS NULL AND invalidated_at IS NULL`; the janitor stamps
-- invalidated_reason = 'EXPIRED' so the slot is reusable after TTL.

CREATE TABLE IF NOT EXISTS public.whatsapp_activation_codes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  display_code TEXT NOT NULL,
  shared_number_index SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  claimed_from_phone TEXT,
  invalidated_at TIMESTAMPTZ,
  invalidated_reason TEXT,
  pending_selection JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wac_active_code
  ON public.whatsapp_activation_codes (code)
  WHERE claimed_at IS NULL AND invalidated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wac_user
  ON public.whatsapp_activation_codes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wac_pending_phone
  ON public.whatsapp_activation_codes ((pending_selection->>'phone_e164'))
  WHERE pending_selection IS NOT NULL
    AND claimed_at IS NULL
    AND invalidated_at IS NULL;

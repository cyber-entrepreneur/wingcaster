-- Model B WhatsApp intake: multi-binding per phone (H2) + CFG seeds (H3).
-- Numbering: 313 is vendor_rate_threshold; 314/315 are this PR.

CREATE TABLE IF NOT EXISTS public.user_whatsapp_bindings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  shared_number_index SMALLINT NOT NULL,
  active_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uwb_phone_active
  ON public.user_whatsapp_bindings (phone_e164, active_from DESC)
  WHERE deactivated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_uwb_user
  ON public.user_whatsapp_bindings (user_id)
  WHERE deactivated_at IS NULL;

-- Stamp intake traffic so the per-agent daily cap and nightly tier alert
-- can count by user / pool index (processed_messages previously had neither).
ALTER TABLE wa_listings.processed_messages
  ADD COLUMN IF NOT EXISTS user_id TEXT;

ALTER TABLE wa_listings.processed_messages
  ADD COLUMN IF NOT EXISTS shared_number_index SMALLINT;

CREATE INDEX IF NOT EXISTS idx_wa_processed_messages_user_processed
  ON wa_listings.processed_messages (user_id, processed_at DESC)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.platform_config (key, value, description) VALUES
  (
    'WHATSAPP_INTAKE_SHARED_NUMBERS',
    '[{"e164":"+15550000001","label":"primary"},{"e164":"+15550000002","label":"secondary"},{"e164":"+15550000003","label":"tertiary"}]',
    'Shared WABA pool for Model B intake. Floor: 3 numbers at launch (H3).'
  ),
  (
    'WHATSAPP_INTAKE_PER_AGENT_DAILY_CAP',
    '500',
    'Per-agent inbound messages per rolling 24h before intake is refused (H3).'
  ),
  (
    'WHATSAPP_INTAKE_TIER_ALERT_PERCENT',
    '70',
    'Warn + audit_log when a pool number exceeds this % of its Meta tier cap (H3).'
  ),
  (
    'WHATSAPP_INTAKE_CODE_TTL_HOURS',
    '24',
    'Activation-code expiry window in hours (H6).'
  ),
  (
    'WHATSAPP_INTAKE_TIER_CAP_PER_NUMBER',
    '10000',
    'Meta messaging-tier cap per shared number (default Tier 2).'
  )
ON CONFLICT (key) DO NOTHING;

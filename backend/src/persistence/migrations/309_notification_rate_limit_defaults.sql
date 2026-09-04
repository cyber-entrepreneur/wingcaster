-- CFG defaults + supporting tables for consumer-notification rate limits,
-- per-recipient cooldowns, and dispatch batching.
--
-- Brief name was 305f_*; lettered files are skipped by runner.js (see 307).
-- Runtime reads env first, then these rows, then hardcoded fallbacks.

CREATE TABLE IF NOT EXISTS public.platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.platform_config (key, value, description) VALUES
  (
    'NOTIFICATION_PER_TENANT_PER_HOUR',
    '1000',
    'Max consumer-notification dispatches per tenant per rolling hour'
  ),
  (
    'NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES',
    '60',
    'Suppress duplicate (tenant, recipient, alert_type) sends within this window'
  ),
  (
    'NOTIFICATION_BATCH_SIZE',
    '100',
    'Chunk size for the retry worker / bulk dispatchers'
  ),
  (
    'NOTIFICATION_INTER_BATCH_DELAY_MS',
    '100',
    'Delay in ms between dispatch chunks'
  )
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.notification_dispatch_rate_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_rate_tenant_created
  ON public.notification_dispatch_rate_events (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_dispatch_cooldowns (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  alert_type TEXT,
  tenant_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_cooldowns_expires
  ON public.notification_dispatch_cooldowns (expires_at);

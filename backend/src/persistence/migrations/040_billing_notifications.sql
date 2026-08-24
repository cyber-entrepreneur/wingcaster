-- Subscription notification engine schema.
--
-- Lives in public (not the retired billing schema) so the notification concept survives
-- the legacy billing strip (DL-244). subscription_id is an opaque TEXT
-- reference — there is no FK onto a billing catalog.
--
--   notification_events
--     Immutable log of every notification-worthy business event.
--   notification_deliveries
--     Per-event, per-channel delivery attempt.
--   notification_preferences
--     Per-tenant opt-in/out. Absent rows mean opted IN.

CREATE TABLE IF NOT EXISTS public.notification_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_kind VARCHAR(80) NOT NULL,
  tenant_id TEXT NOT NULL,
  subscription_id TEXT,
  subject TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_notification_events_tenant
  ON public.notification_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_events_kind_created
  ON public.notification_events(event_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_events_subscription
  ON public.notification_events(subscription_id, created_at DESC)
  WHERE subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL
    CHECK (channel IN ('email','sms','whatsapp','in_app')),
  destination TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  skip_reason TEXT,
  provider TEXT,
  provider_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  attempted_at TIMESTAMPTZ,
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_event
  ON public.notification_deliveries(event_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status
  ON public.notification_deliveries(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel_status
  ON public.notification_deliveries(channel, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  event_kind VARCHAR(80) NOT NULL,
  channel VARCHAR(20) NOT NULL
    CHECK (channel IN ('email','sms','whatsapp','in_app')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(tenant_id, event_kind, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_tenant
  ON public.notification_preferences(tenant_id);

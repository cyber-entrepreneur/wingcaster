-- Growth-OS Wave 0 — shared vocabularies (land BEFORE table migrations).
-- Repo uses TEXT + CHECK, not CREATE TYPE … AS ENUM. Parallel-PR CI requires
-- these validators to ship in their own migration so table PRs can reference
-- stable function names without bundling enum literals into competing migrations.
--
-- Source: Wave 0 / D15 prompt (docs/canonical-object-model.md was not in-repo
-- at land time; see PR assumptions).

CREATE OR REPLACE FUNCTION public.growth_os_is_execution_kind(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'message', 'social_post', 'paid_ad', 'portal_submit', 'seo_page'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_execution_status(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'draft', 'scheduled', 'in_review', 'queued', 'processing',
    'published', 'failed', 'cancelled'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_channel_definition_kind(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'owned_messaging', 'organic_social', 'paid', 'portal'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_channel_connection_health(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'connected', 'disconnected', 'expired', 'error'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_event_category(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'business', 'delivery', 'engagement', 'system'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_consent_status(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'granted', 'denied', 'withdrawn'
  );
$$;

CREATE OR REPLACE FUNCTION public.growth_os_is_consent_purpose(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'marketing', 'transactional', 'nurture'
  );
$$;

-- Map legacy distribution/publishing statuses into canonical execution.status.
CREATE OR REPLACE FUNCTION public.growth_os_map_legacy_execution_status(v TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(v, ''))
    WHEN 'draft' THEN 'draft'
    WHEN 'scheduled' THEN 'scheduled'
    WHEN 'pending' THEN 'queued'
    WHEN 'queued' THEN 'queued'
    WHEN 'pending_retry' THEN 'queued'
    WHEN 'pending_moderation' THEN 'in_review'
    WHEN 'in_review' THEN 'in_review'
    WHEN 'submitted' THEN 'in_review'
    WHEN 'processing' THEN 'processing'
    WHEN 'published' THEN 'published'
    WHEN 'success' THEN 'published'
    WHEN 'live' THEN 'published'
    WHEN 'succeeded' THEN 'published'
    WHEN 'failed' THEN 'failed'
    WHEN 'error' THEN 'failed'
    WHEN 'rejected' THEN 'failed'
    WHEN 'expired' THEN 'failed'
    WHEN 'dead_letter' THEN 'failed'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'canceled' THEN 'cancelled'
    WHEN 'active' THEN 'queued'
    WHEN 'connected' THEN 'published'
    ELSE 'queued'
  END;
$$;

-- Infer channel_definition.kind from a legacy platform string.
CREATE OR REPLACE FUNCTION public.growth_os_infer_channel_kind(platform TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(platform, '')) IN (
      'whatsapp', 'email', 'sms', 'imessage', 'telegram'
    ) THEN 'owned_messaging'
    WHEN lower(coalesce(platform, '')) IN (
      'meta_ads', 'google_ads', 'tiktok_ads', 'linkedin_ads', 'paid'
    ) THEN 'paid'
    WHEN lower(coalesce(platform, '')) IN (
      'instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'x',
      'youtube', 'threads', 'pinterest', 'snapchat'
    ) THEN 'organic_social'
    ELSE 'portal'
  END;
$$;

-- Map legacy connection status/health into channel_connection.health.
CREATE OR REPLACE FUNCTION public.growth_os_map_legacy_connection_health(
  status TEXT,
  health TEXT,
  expires_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP THEN 'expired'
    WHEN lower(coalesce(health, '')) IN ('error', 'unhealthy', 'degraded') THEN 'error'
    WHEN lower(coalesce(status, '')) IN ('disconnected', 'inactive', 'revoked') THEN 'disconnected'
    WHEN lower(coalesce(status, '')) IN ('error', 'failed') THEN 'error'
    WHEN lower(coalesce(status, '')) IN ('expired') THEN 'expired'
    WHEN lower(coalesce(health, '')) IN ('healthy', 'ok') THEN 'connected'
    WHEN lower(coalesce(status, '')) IN ('connected', 'active', '') THEN 'connected'
    ELSE 'connected'
  END;
$$;

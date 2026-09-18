-- AGN-WLB-005 — Promote website_analytics out of legacy_collections and
-- index hot agency + date-range queries for the white-label analytics screen.

CREATE TABLE IF NOT EXISTS public.website_analytics (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  site_id TEXT,
  page VARCHAR(500),
  device VARCHAR(60),
  event_type VARCHAR(40) NOT NULL DEFAULT 'pageview'
    CHECK (event_type IN ('pageview', 'inquiry', 'conversion')),
  referrer VARCHAR(200),
  property_id TEXT,
  session_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_website_analytics_agency_created
  ON public.website_analytics(agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_analytics_agency_event_created
  ON public.website_analytics(agency_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_analytics_agency_property
  ON public.website_analytics(agency_id, property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

INSERT INTO public.website_analytics (
  id,
  agency_id,
  site_id,
  page,
  device,
  event_type,
  referrer,
  property_id,
  session_id,
  meta,
  created_at,
  updated_at,
  data
)
SELECT
  lc.id,
  COALESCE(lc.data->>'agency_id', lc.data->'data'->>'agency_id'),
  COALESCE(lc.data->>'site_id', lc.data->'data'->>'site_id'),
  COALESCE(lc.data->>'page', lc.data->'data'->>'page'),
  COALESCE(lc.data->>'device', lc.data->'data'->>'device', 'unknown'),
  COALESCE(
    NULLIF(lc.data->>'event_type', ''),
    NULLIF(lc.data->'meta'->>'event_type', ''),
    NULLIF(lc.data->'data'->'meta'->>'event_type', ''),
    'pageview'
  ),
  COALESCE(
    NULLIF(lc.data->>'referrer', ''),
    NULLIF(lc.data->'meta'->>'referrer', ''),
    NULLIF(lc.data->'data'->'meta'->>'referrer', '')
  ),
  COALESCE(
    NULLIF(lc.data->>'property_id', ''),
    NULLIF(lc.data->'meta'->>'property_id', ''),
    NULLIF(lc.data->'data'->'meta'->>'property_id', '')
  ),
  COALESCE(
    NULLIF(lc.data->>'session_id', ''),
    NULLIF(lc.data->'meta'->>'session_id', ''),
    NULLIF(lc.data->'data'->'meta'->>'session_id', '')
  ),
  COALESCE(lc.data->'meta', lc.data->'data'->'meta', '{}'::jsonb),
  COALESCE(
    (lc.data->>'created_at')::timestamptz,
    (lc.data->'data'->>'created_at')::timestamptz,
    lc.created_at
  ),
  lc.updated_at,
  lc.data
FROM public.legacy_collections lc
WHERE lc.collection = 'website_analytics'
  AND COALESCE(lc.data->>'agency_id', lc.data->'data'->>'agency_id') IS NOT NULL
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.legacy_collections
WHERE collection = 'website_analytics'
  AND id IN (SELECT id FROM public.website_analytics);

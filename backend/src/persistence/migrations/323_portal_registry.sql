-- BE-DESIGN-01 — dynamic portal_registry + activation audit tables.
-- Idempotent. Migration numbers 316-322 are reserved for other Wave 0.5 work / PR #51.

CREATE TABLE IF NOT EXISTS public.portal_registry (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  country_codes TEXT[] NOT NULL DEFAULT '{}',
  primary_language TEXT,
  adapter_class_name TEXT NOT NULL,
  publisher_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  inbound_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  validator_ref TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portal_registry_active
  ON public.portal_registry (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_portal_registry_country_codes
  ON public.portal_registry USING GIN (country_codes);

-- PA-POR-002 — pending portal activation requests (two-person friendly).
-- Brief not in-tree yet; shape mirrors fin.approval_requests lifecycle fields.
CREATE TABLE IF NOT EXISTS public.portal_registry_pending_activations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  portal_id TEXT NOT NULL REFERENCES public.portal_registry(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  proposed_is_active BOOLEAN NOT NULL DEFAULT true,
  proposed_publisher_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_inbound_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_country_codes TEXT[],
  proposed_effective_from TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  approval_request_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_pending_activation_open
  ON public.portal_registry_pending_activations (portal_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_portal_pending_activations_status
  ON public.portal_registry_pending_activations (status, requested_at DESC);

-- PA-POR-003 — immutable activation / deactivation audit trail.
CREATE TABLE IF NOT EXISTS public.portal_activation_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  portal_id TEXT NOT NULL REFERENCES public.portal_registry(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN (
      'activate', 'deactivate', 'deprecate', 'config_change',
      'activation_requested', 'activation_rejected', 'activation_cancelled'
    )),
  actor_id TEXT,
  pending_activation_id TEXT REFERENCES public.portal_registry_pending_activations(id) ON DELETE SET NULL,
  approval_request_id UUID,
  from_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  to_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portal_activation_history_portal
  ON public.portal_activation_history (portal_id, created_at DESC);

-- Seed the four existing publisher stubs as inactive so boot/wiring is safe.
-- Feature codes already live in metered_features (migration 303); adapters remain
-- NOT_IMPLEMENTED. ON CONFLICT DO NOTHING keeps re-runs idempotent.
INSERT INTO public.portal_registry (
  id, code, display_name, description, country_codes, primary_language,
  adapter_class_name, publisher_config, inbound_config, validator_ref,
  is_active, effective_from
) VALUES
  (
    '32300000-0000-4000-8000-000000000001',
    'olx',
    'OLX',
    'OLX MENA classifieds (stub adapter — NOT_IMPLEMENTED)',
    ARRAY['AE','SA','EG','LB','JO']::text[],
    'en',
    'OlxPortalPublisher',
    '{"stub":true,"status":"NOT_IMPLEMENTED"}'::jsonb,
    '{"stub":true,"inbound":"NOT_IMPLEMENTED"}'::jsonb,
    'portals/olx',
    false,
    NULL
  ),
  (
    '32300000-0000-4000-8000-000000000002',
    'property_finder',
    'Property Finder',
    'Property Finder Group (stub adapter — NOT_IMPLEMENTED)',
    ARRAY['AE','SA','EG','LB','JO','QA','KW','BH','OM']::text[],
    'en',
    'PropertyFinderPortalPublisher',
    '{"stub":true,"status":"NOT_IMPLEMENTED"}'::jsonb,
    '{"stub":true,"inbound":"NOT_IMPLEMENTED"}'::jsonb,
    'portals/property_finder',
    false,
    NULL
  ),
  (
    '32300000-0000-4000-8000-000000000003',
    'bayut',
    'Bayut',
    'Bayut (Dubizzle Group) stub adapter — NOT_IMPLEMENTED',
    ARRAY['AE','SA','EG']::text[],
    'en',
    'BayutPortalPublisher',
    '{"stub":true,"status":"NOT_IMPLEMENTED"}'::jsonb,
    '{"stub":true,"inbound":"NOT_IMPLEMENTED"}'::jsonb,
    'portals/bayut',
    false,
    NULL
  ),
  (
    '32300000-0000-4000-8000-000000000004',
    'dubizzle',
    'dubizzle',
    'dubizzle UAE stub adapter — NOT_IMPLEMENTED',
    ARRAY['AE']::text[],
    'en',
    'DubizzlePortalPublisher',
    '{"stub":true,"status":"NOT_IMPLEMENTED"}'::jsonb,
    '{"stub":true,"inbound":"NOT_IMPLEMENTED"}'::jsonb,
    'portals/dubizzle',
    false,
    NULL
  )
ON CONFLICT (code) DO NOTHING;

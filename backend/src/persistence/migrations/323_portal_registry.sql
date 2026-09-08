-- BE-DESIGN-01 — dynamic portal_registry + PA-POR-003 activation tables.
-- Idempotent. Do NOT use 316–322 (reserved for other Wave 0.5 agents).
-- Country codes: PORTAL_LIST_RESEARCH_2026-09-04.md D19 documented subset.
--   property_finder  AE/SA/EG/LB/JO/QA/KW/BH/OM
--   bayut            AE/SA
--   dubizzle         AE
--   olx              EG/LB
-- adapter_class_name is a module path under lib/notifications (e.g. portals/olx.js).

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

-- PA-POR-003 two-person state machine (coordinator column contract).
CREATE TABLE IF NOT EXISTS public.portal_registry_pending_activations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  portal_code TEXT NOT NULL REFERENCES public.portal_registry(code) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('activate', 'deactivate')),
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'approved', 'rejected', 'withdrawn')),
  submitter_user_id TEXT NOT NULL,
  approver_user_id TEXT,
  submitter_notes TEXT,
  approver_notes TEXT,
  effective_from TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_pending_activation_open
  ON public.portal_registry_pending_activations (portal_code)
  WHERE state = 'pending';

CREATE INDEX IF NOT EXISTS idx_portal_pending_activations_state
  ON public.portal_registry_pending_activations (state, created_at DESC);

-- PA-POR-003 immutable timeline.
CREATE TABLE IF NOT EXISTS public.portal_activation_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  portal_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  submitter_user_id TEXT,
  approver_user_id TEXT,
  notes TEXT,
  before_json JSONB,
  after_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portal_activation_history_portal
  ON public.portal_activation_history (portal_code, created_at DESC);

CREATE OR REPLACE FUNCTION public.portal_registry_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_registry_touch_updated_at ON public.portal_registry;
CREATE TRIGGER trg_portal_registry_touch_updated_at
  BEFORE UPDATE ON public.portal_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.portal_registry_touch_updated_at();

CREATE OR REPLACE FUNCTION public.portal_activation_history_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'portal_activation_history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_activation_history_no_update ON public.portal_activation_history;
CREATE TRIGGER trg_portal_activation_history_no_update
  BEFORE UPDATE OR DELETE ON public.portal_activation_history
  FOR EACH ROW
  EXECUTE FUNCTION public.portal_activation_history_append_only();

INSERT INTO public.portal_registry (
  id, code, display_name, description, country_codes, primary_language,
  adapter_class_name, publisher_config, inbound_config, validator_ref,
  is_active, effective_from
) VALUES
  (
    '32300000-0000-4000-8000-000000000001',
    'olx',
    'OLX',
    'STUB — OLX MENA classifieds (EG/LB). Publisher API not wired (BE-BLOCKER-01).',
    ARRAY['EG','LB']::text[],
    'ar',
    'portals/olx.js',
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
    'STUB — Property Finder Group (AE/SA/EG/LB/JO/QA/KW/BH/OM). Publisher API not wired (BE-BLOCKER-01).',
    ARRAY['AE','SA','EG','LB','JO','QA','KW','BH','OM']::text[],
    'en',
    'portals/property_finder.js',
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
    'STUB — Bayut (AE/SA). Publisher API not wired (BE-BLOCKER-01).',
    ARRAY['AE','SA']::text[],
    'en',
    'portals/bayut.js',
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
    'STUB — dubizzle (AE). Publisher API not wired (BE-BLOCKER-01).',
    ARRAY['AE']::text[],
    'en',
    'portals/dubizzle.js',
    '{"stub":true,"status":"NOT_IMPLEMENTED"}'::jsonb,
    '{"stub":true,"inbound":"NOT_IMPLEMENTED"}'::jsonb,
    'portals/dubizzle',
    false,
    NULL
  )
ON CONFLICT (code) DO NOTHING;

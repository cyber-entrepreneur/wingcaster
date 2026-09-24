-- PR0 — listing authorization + anti-fraud verification (Layers B/C/D).
-- Additive, nullable columns on public.properties (no shared CHECK/enum edits →
-- safe for parallel Real-PG) + an append-only listing_verifications audit table.
--
-- NB: RLS intentionally omitted on listing_verifications — the property
-- create/update path does not run under the growth_os_app_role GUC plumbing, so
-- RLS here would break inserts. Tenant isolation is enforced by carrying
-- agency_id + tenant_id and scoping every read in SQL (never findAll + JS filter).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS listing_role TEXT,
  ADD COLUMN IF NOT EXISTS represents_type TEXT,
  ADD COLUMN IF NOT EXISTS represents_name TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS idx_properties_country_code
  ON public.properties (country_code);

CREATE INDEX IF NOT EXISTS idx_properties_verification_status
  ON public.properties (verification_status);

CREATE TABLE IF NOT EXISTS public.listing_verifications (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  tenant_id TEXT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  control_key TEXT,
  source TEXT,
  evidence_ref TEXT,
  actor_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_listing_verifications_property_id
  ON public.listing_verifications (property_id);

CREATE INDEX IF NOT EXISTS idx_listing_verifications_tenant
  ON public.listing_verifications (agency_id, tenant_id);

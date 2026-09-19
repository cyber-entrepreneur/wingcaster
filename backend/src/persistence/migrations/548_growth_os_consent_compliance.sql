-- Growth-OS Wave 0 — consent compliance tightening (spec §5 / §7 / §9).
-- Additive: legal_basis validator, append-only history, consent_current view.

CREATE OR REPLACE FUNCTION public.growth_os_is_consent_legal_basis(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IS NULL OR v IN (
    'explicit_optin',
    'double_optin',
    'contract',
    'legitimate_interest',
    'soft_optin_existing_customer'
  );
$$;

ALTER TABLE public.consent
  DROP CONSTRAINT IF EXISTS consent_legal_basis_check;

ALTER TABLE public.consent
  ADD CONSTRAINT consent_legal_basis_check
    CHECK (public.growth_os_is_consent_legal_basis(legal_basis));

-- Append-only history: drop the upsert unique index from 545.
DROP INDEX IF EXISTS public.uq_consent_contact_channel_purpose;

CREATE INDEX IF NOT EXISTS idx_consent_contact_channel_purpose_captured
  ON public.consent (contact_id, channel, purpose, captured_at DESC);

-- Latest row per (contact_id, channel, purpose) — spec §7 / §9.
CREATE OR REPLACE VIEW public.consent_current AS
  SELECT DISTINCT ON (contact_id, channel, purpose) *
  FROM public.consent
  ORDER BY contact_id, channel, purpose, captured_at DESC, created_at DESC;

GRANT SELECT ON public.consent_current TO growth_os_app_role;

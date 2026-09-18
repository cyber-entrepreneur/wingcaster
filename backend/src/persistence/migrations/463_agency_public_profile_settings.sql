-- AGN-PUB-001: agency-controlled public profile visibility and copy.

CREATE TABLE IF NOT EXISTS public.agency_public_profile_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id TEXT NOT NULL UNIQUE REFERENCES public.agencies(id) ON DELETE CASCADE,
  show_team BOOLEAN NOT NULL DEFAULT true,
  show_listings BOOLEAN NOT NULL DEFAULT true,
  show_reviews BOOLEAN NOT NULL DEFAULT true,
  show_closed_transactions BOOLEAN NOT NULL DEFAULT false,
  show_contact_form BOOLEAN NOT NULL DEFAULT true,
  hero_title VARCHAR(120),
  hero_body VARCHAR(600),
  meta_description VARCHAR(160),
  updated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agency_public_profile_settings_agency
  ON public.agency_public_profile_settings(agency_id);

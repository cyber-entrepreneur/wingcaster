-- AGN-WLB-003 — agency white-label site configuration + copy fields.

CREATE TABLE IF NOT EXISTS public.agency_site_config (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL UNIQUE REFERENCES public.agencies(id) ON DELETE CASCADE,
  template_id TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT,
  accent_color TEXT,
  font_pair TEXT,
  copy_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_domain TEXT,
  ssl_status TEXT NOT NULL DEFAULT 'none',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agency_site_config_agency
  ON public.agency_site_config(agency_id);

-- AGN-SET-002: first-class agency identity and brand settings.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary_color VARCHAR(7),
  ADD COLUMN IF NOT EXISTS brand_accent_color VARCHAR(7),
  ADD COLUMN IF NOT EXISTS brand_font_family VARCHAR(80),
  ADD COLUMN IF NOT EXISTS brand_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS brand_updated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL;

-- Legacy agency identity fields lived only in the JSONB document. Backfill
-- before typed columns take precedence during hydration.
UPDATE public.agencies
SET
  description = COALESCE(description, NULLIF(data->>'description', '')),
  logo_url = COALESCE(logo_url, NULLIF(data->>'logo_url', ''), NULLIF(data->>'logo', '')),
  favicon_url = COALESCE(favicon_url, NULLIF(data->>'favicon_url', '')),
  brand_primary_color = COALESCE(
    brand_primary_color,
    CASE
      WHEN COALESCE(NULLIF(data->>'brand_primary_color', ''), NULLIF(data->>'primary_color', ''))
        ~ '^#[0-9A-Fa-f]{6}$'
      THEN UPPER(COALESCE(NULLIF(data->>'brand_primary_color', ''), NULLIF(data->>'primary_color', '')))
    END
  ),
  brand_accent_color = COALESCE(
    brand_accent_color,
    CASE
      WHEN COALESCE(NULLIF(data->>'brand_accent_color', ''), NULLIF(data->>'secondary_color', ''))
        ~ '^#[0-9A-Fa-f]{6}$'
      THEN UPPER(COALESCE(NULLIF(data->>'brand_accent_color', ''), NULLIF(data->>'secondary_color', '')))
    END
  ),
  brand_font_family = COALESCE(
    brand_font_family,
    CASE
      WHEN COALESCE(NULLIF(data->>'brand_font_family', ''), NULLIF(data->>'font_family', ''))
        IN ('system', 'ibm-plex-sans', 'archivo', 'playfair-display')
      THEN COALESCE(NULLIF(data->>'brand_font_family', ''), NULLIF(data->>'font_family', ''))
    END
  );

ALTER TABLE public.agencies
  DROP CONSTRAINT IF EXISTS agencies_brand_primary_color_format,
  ADD CONSTRAINT agencies_brand_primary_color_format
    CHECK (brand_primary_color IS NULL OR brand_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  DROP CONSTRAINT IF EXISTS agencies_brand_accent_color_format,
  ADD CONSTRAINT agencies_brand_accent_color_format
    CHECK (brand_accent_color IS NULL OR brand_accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  DROP CONSTRAINT IF EXISTS agencies_brand_font_family_allowed,
  ADD CONSTRAINT agencies_brand_font_family_allowed
    CHECK (
      brand_font_family IS NULL OR brand_font_family IN (
        'system',
        'ibm-plex-sans',
        'archivo',
        'playfair-display'
      )
    );

CREATE INDEX IF NOT EXISTS idx_agencies_brand_updated_at
  ON public.agencies(brand_updated_at DESC)
  WHERE brand_updated_at IS NOT NULL;

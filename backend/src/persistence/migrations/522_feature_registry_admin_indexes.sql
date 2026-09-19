-- PA-PKG-007 — Feature registry admin list filters (category, active, code order).
-- Additive only: metered_features exists from migration 302.

CREATE INDEX IF NOT EXISTS idx_metered_features_category_active_code
  ON public.metered_features (category, active, code);

CREATE INDEX IF NOT EXISTS idx_metered_features_active_code
  ON public.metered_features (active, code)
  WHERE active = true;

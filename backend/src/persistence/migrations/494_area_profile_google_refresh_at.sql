-- PA-ARE-002: track last on-demand Google signals refresh per area profile.
ALTER TABLE area_intelligence.area_profiles
  ADD COLUMN IF NOT EXISTS last_google_signals_refresh_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_area_profiles_last_google_refresh
  ON area_intelligence.area_profiles (last_google_signals_refresh_at DESC NULLS LAST)
  WHERE last_google_signals_refresh_at IS NOT NULL;

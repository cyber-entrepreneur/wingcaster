-- PA-SCR-003: scoring recalculation read paths (additive indexes only).

CREATE INDEX IF NOT EXISTS idx_area_profiles_scoring_enabled
  ON area_intelligence.area_profiles (status)
  WHERE status = 'scoring_enabled';

CREATE INDEX IF NOT EXISTS idx_area_score_calculations_area_calculated
  ON area_intelligence.area_score_calculations (area_id, calculated_at DESC);

-- PA-SCR-004: manual score override lookups (additive indexes only).

CREATE INDEX IF NOT EXISTS idx_area_score_calculations_manual_override
  ON area_intelligence.area_score_calculations (area_id, dimension_id, calculated_at DESC)
  WHERE is_manual_override = true;

-- Property AI ratings (JSON object from rateProperty).
--
-- Spec referred to this as 305b_property_ai_ratings.sql. The migration runner
-- treats NNN[letter]_*.sql as operator-only (not auto-applied), so this ships
-- as 310 so it actually runs on deploy (307-309 are consumed by notification
-- dispatch).

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS ai_ratings JSONB;

CREATE INDEX IF NOT EXISTS idx_properties_ai_ratings_gin
  ON properties USING GIN (ai_ratings);

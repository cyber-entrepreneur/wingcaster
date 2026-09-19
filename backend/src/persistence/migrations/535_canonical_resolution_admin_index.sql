-- PA-PVA-011 — canonical property resolution admin queue lookups.

CREATE INDEX IF NOT EXISTS idx_properties_canonical_status
  ON properties (canonical_id, status)
  WHERE canonical_id IS NOT NULL;

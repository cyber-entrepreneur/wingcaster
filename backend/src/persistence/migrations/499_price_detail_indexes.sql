-- PA-PRC-002: hot-path index for price detail version timeline reads.
CREATE INDEX IF NOT EXISTS idx_price_versions_price_version_n
  ON fin.price_versions (price_id, version_n DESC);

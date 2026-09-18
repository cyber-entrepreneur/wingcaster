-- PA-PRC-003: price version draft creation lookups.

CREATE INDEX IF NOT EXISTS idx_fin_price_versions_price_status
  ON fin.price_versions (price_id, status);

CREATE INDEX IF NOT EXISTS idx_fin_prices_env_code
  ON fin.prices (environment, code);

-- PA-VEN-003: vendor rate upsert lookups.

CREATE INDEX IF NOT EXISTS idx_fin_vendor_products_vendor_code
  ON fin.vendor_products (vendor_id, product_code);

CREATE INDEX IF NOT EXISTS idx_fin_vendor_rate_versions_card_effective
  ON fin.vendor_rate_versions (rate_card_id, effective_from DESC);

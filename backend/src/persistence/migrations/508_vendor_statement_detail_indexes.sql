-- PA-VEN-004: vendor statement detail read paths (additive indexes only).

CREATE INDEX IF NOT EXISTS idx_fin_vendor_statements_vendor_env_period
  ON fin.vendor_statements (vendor_id, environment, statement_period_key DESC);

CREATE INDEX IF NOT EXISTS idx_fin_vendor_variances_statement_resolved
  ON fin.vendor_variances (statement_id, resolved);

CREATE INDEX IF NOT EXISTS idx_fin_vendor_statement_lines_statement_product
  ON fin.vendor_statement_lines (statement_id, product_code);

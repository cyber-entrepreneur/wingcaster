-- PA-CON-002: hot-path indexes for contract detail reads (versions + components).
CREATE INDEX IF NOT EXISTS idx_contract_versions_contract_version_n
  ON fin.contract_versions (contract_id, version_n DESC);

CREATE INDEX IF NOT EXISTS idx_contract_components_version_created
  ON fin.contract_components (contract_version_id, created_at);

-- PA-CON-003: speed draft-version lookups for contract version editor entry.
CREATE INDEX IF NOT EXISTS idx_contract_versions_draft_by_contract
  ON fin.contract_versions (contract_id)
  WHERE status = 'DRAFT';

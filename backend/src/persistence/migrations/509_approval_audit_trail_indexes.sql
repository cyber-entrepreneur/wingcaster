-- PA-APR-004: approval audit trail read paths (additive indexes only).

CREATE INDEX IF NOT EXISTS idx_fin_financial_audit_events_approval_request
  ON fin.financial_audit_events (environment, approval_request_id, created_at ASC, id ASC)
  WHERE approval_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_approval_actions_request_created
  ON fin.approval_actions (request_id, created_at ASC, id ASC);

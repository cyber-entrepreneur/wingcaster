-- BE-BLOCKER-34 confirmation phrases
CREATE TABLE IF NOT EXISTS fin.approval_confirmation_phrases (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES fin.approval_requests(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  phrase TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  UNIQUE (request_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_approval_confirmation_phrases_request
  ON fin.approval_confirmation_phrases (request_id, attempt_number DESC);
GRANT SELECT, INSERT, UPDATE ON fin.approval_confirmation_phrases TO fin_app_role, fin_finance_role;
GRANT SELECT ON fin.approval_confirmation_phrases TO fin_auditor_role;

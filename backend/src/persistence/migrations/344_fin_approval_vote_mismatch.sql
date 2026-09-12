-- BE-BLOCKER-34 vote-mismatch columns
ALTER TABLE fin.approval_requests
  ADD COLUMN IF NOT EXISTS escalation_case_id UUID,
  ADD COLUMN IF NOT EXISTS vote_mismatch_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_approval_requests_escalation_case
  ON fin.approval_requests (escalation_case_id) WHERE escalation_case_id IS NOT NULL;

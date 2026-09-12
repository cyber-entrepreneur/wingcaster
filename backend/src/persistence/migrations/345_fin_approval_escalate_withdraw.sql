-- BE-BLOCKER-33 / PA-APR-005 + PA-APR-006
-- Escalate + withdraw columns on fin.approval_requests, plus WITHDRAWN status.
--
-- NOTE: BE-34 (unified /execute) may also alter fin.approval_requests.
-- This migration uses additive ALTER TABLE … ADD COLUMN IF NOT EXISTS only
-- (aside from the status CHECK drop/recreate required to admit WITHDRAWN).

-- ---------------------------------------------------------------------------
-- Status CHECK: admit WITHDRAWN (preserve existing statuses)
-- ---------------------------------------------------------------------------
ALTER TABLE fin.approval_requests
  DROP CONSTRAINT IF EXISTS approval_requests_status_check;

ALTER TABLE fin.approval_requests
  ADD CONSTRAINT approval_requests_status_check
  CHECK (status IN (
    'REQUESTED',
    'APPROVED',
    'REJECTED',
    'CANCELED',
    'EXECUTED',
    'EXPIRED',
    'WITHDRAWN'
  ));

-- ---------------------------------------------------------------------------
-- Escalation columns (PA-APR-005)
-- ---------------------------------------------------------------------------
ALTER TABLE fin.approval_requests
  ADD COLUMN IF NOT EXISTS escalated_from UUID,
  ADD COLUMN IF NOT EXISTS escalated_to UUID,
  ADD COLUMN IF NOT EXISTS escalated_to_user_id UUID,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
  ADD COLUMN IF NOT EXISTS escalation_rationale TEXT,
  ADD COLUMN IF NOT EXISTS escalation_notes TEXT,
  ADD COLUMN IF NOT EXISTS escalation_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escalation_notify_channels JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Withdraw columns (PA-APR-006)
-- ---------------------------------------------------------------------------
ALTER TABLE fin.approval_requests
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawn_by UUID,
  ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;

-- Queue sort / audit helpers
CREATE INDEX IF NOT EXISTS idx_approval_requests_escalated_to
  ON fin.approval_requests (escalated_to)
  WHERE escalated_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_withdrawn
  ON fin.approval_requests (status)
  WHERE status = 'WITHDRAWN';

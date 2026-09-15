-- Wave 5 Agent 6: admit dead_letter for SLA-stuck WF-05/WF-06 approval requests.
-- Additive status CHECK rewrite only (preserves existing statuses + WITHDRAWN).
-- Depends on 362_fin_approval_action_kinds_wf05_wf06.sql (PR-A / #178) for
-- COMPARABLE_REMOVE / PRICE_REPORT_INCORPORATE — action_kind CHECK lives in 362,
-- not rewritten here.

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
    'WITHDRAWN',
    'dead_letter'
  ));

CREATE INDEX IF NOT EXISTS idx_approval_requests_sla_stuck
  ON fin.approval_requests (action_kind, status, created_at)
  WHERE status = 'REQUESTED'
    AND action_kind IN ('COMPARABLE_REMOVE', 'PRICE_REPORT_INCORPORATE');

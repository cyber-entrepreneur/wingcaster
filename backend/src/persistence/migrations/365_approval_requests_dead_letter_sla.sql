-- Wave 5 Agent 6: SLA-stuck index for WF-05/WF-06 approval requests.
-- Shared status CHECK rewrite (dead_letter + WITHDRAWN) lives in
-- 366_approval_requests_status_dead_letter.sql (PR-B / #179) — do NOT
-- DROP/ADD approval_requests_status_check here.
--
-- Depends on: 362_* (action_kind CHECK) and 366_* (status CHECK including
-- dead_letter). This file is fixture/table remainder only.

CREATE INDEX IF NOT EXISTS idx_approval_requests_sla_stuck
  ON fin.approval_requests (action_kind, status, created_at)
  WHERE status = 'REQUESTED'
    AND action_kind IN ('COMPARABLE_REMOVE', 'PRICE_REPORT_INCORPORATE');

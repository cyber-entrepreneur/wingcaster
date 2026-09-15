-- Extracted shared CHECK expansion for approval_requests.status.
-- Lands BEFORE feat/wave-5-e2e (#132) so that branch keeps only the SLA index
-- remainder in 365_* and does not rewrite this shared constraint.
--
-- History: 345 (BE-BLOCKER-33 / PA-APR-005/006) admitted WITHDRAWN via DROP+ADD.
-- #132's 365_approval_requests_dead_letter_sla.sql originally also DROP/ADDed
-- approval_requests_status_check to admit 'dead_letter' — the same shared-
-- constraint-in-a-feature-PR pattern that broke parallel Real-PG landings
-- before #178 (362_* action_kind extract). This migration re-asserts the full
-- expanded value set (idempotent DROP + ADD) as the formal Wave 5 status
-- extract (PR-B) so later parallel landings cannot silently drop statuses.
--
-- Downstream: #132 rebases after this lands and removes the CHECK rewrite
-- from 365, leaving only idx_approval_requests_sla_stuck (fixture/table
-- remainder).

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

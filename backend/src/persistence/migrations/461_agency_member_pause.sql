-- AGN-MEM-008 — Pause member (temporary suspension, reversible).
--
-- A paused member keeps their membership row but is temporarily suspended:
-- `agency_members.status = 'paused'` (legacy roster source of truth) with a
-- first-class `pause_reason`, and the canonical `tenant_memberships.status`
-- moves to the existing 'suspended' state so active-only access + routing
-- queries exclude them until an owner/admin resumes them.
--
-- These columns capture WHO paused, WHEN, and WHY, for the roster UI and the
-- audit trail. Resume clears them and restores status to 'active'.

ALTER TABLE agency_members
  ADD COLUMN IF NOT EXISTS pause_reason TEXT,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_by TEXT;

CREATE INDEX IF NOT EXISTS idx_agency_members_status
  ON agency_members(agency_id, status);

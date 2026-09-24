-- SHR-ERR-002 — 403 / Permission denied → "Request access".
--
-- When an authenticated user hits a permission boundary (a platform-admin
-- area, an agency surface they are not a member of, a resource they cannot
-- see), the permission-denied screen lets them ask the appropriate party for
-- access. That request is recorded here and a notification is delivered to the
-- responsible party (agency owner for agency scope, platform admins for
-- platform scope).
--
-- Leak-safe: a request can be filed for a scope/resource the requester cannot
-- see, and the row never confirms whether that resource exists. Ownership is
-- the requester themselves — reads are scoped to requester_id.
CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,        -- user who asked (owns the row)
  requester_name TEXT,               -- display snapshot at request time
  scope TEXT NOT NULL DEFAULT 'platform',
  agency_id TEXT,                    -- target agency for scope 'agency' / agency-owned resource
  resource_type TEXT,               -- coarse area/resource kind (e.g. 'page', 'report')
  resource_id TEXT,                 -- specific resource id when applicable
  area_label TEXT,                  -- human label of the area, for the notified party
  reason TEXT,                      -- optional note from the requester
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT access_requests_scope_check
    CHECK (scope IN ('platform', 'agency', 'resource')),
  CONSTRAINT access_requests_status_check
    CHECK (status IN ('open', 'granted', 'denied', 'dismissed'))
);

-- Requester's own history (the "already requested" lookup) — newest first.
CREATE INDEX IF NOT EXISTS idx_access_requests_requester
  ON access_requests(requester_id, created_at DESC);

-- The agency owner's review queue for their tenant.
CREATE INDEX IF NOT EXISTS idx_access_requests_agency
  ON access_requests(agency_id)
  WHERE agency_id IS NOT NULL;

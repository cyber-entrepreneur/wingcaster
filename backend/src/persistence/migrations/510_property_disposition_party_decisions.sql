-- AGT-LST-013: persist each party's proposed property disposition and notes.
-- The original workflow stored one proposal plus approve/reject flags, which
-- could not represent two independent choices or a disputed recommendation.

ALTER TABLE property_disposition_cases
  ADD COLUMN IF NOT EXISTS agency_proposed_disposition TEXT,
  ADD COLUMN IF NOT EXISTS agent_proposed_disposition TEXT,
  ADD COLUMN IF NOT EXISTS agency_notes TEXT,
  ADD COLUMN IF NOT EXISTS agent_notes TEXT;

ALTER TABLE property_disposition_cases
  DROP CONSTRAINT IF EXISTS property_disposition_cases_agency_proposed_disposition_check;
ALTER TABLE property_disposition_cases
  ADD CONSTRAINT property_disposition_cases_agency_proposed_disposition_check
  CHECK (
    agency_proposed_disposition IS NULL
    OR agency_proposed_disposition IN ('agency_retains', 'agent_retains', 'archive')
  );

ALTER TABLE property_disposition_cases
  DROP CONSTRAINT IF EXISTS property_disposition_cases_agent_proposed_disposition_check;
ALTER TABLE property_disposition_cases
  ADD CONSTRAINT property_disposition_cases_agent_proposed_disposition_check
  CHECK (
    agent_proposed_disposition IS NULL
    OR agent_proposed_disposition IN ('agency_retains', 'agent_retains', 'archive')
  );

CREATE INDEX IF NOT EXISTS idx_property_disposition_cases_parties_status
  ON property_disposition_cases(agency_tenant_id, personal_tenant_id, status);

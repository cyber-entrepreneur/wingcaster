-- AGN-REP-003 — indexes for agency lead-conversion funnel queries.
-- Hot paths: filter inquiries/viewings/opportunities by agency_id + created_at,
-- join viewings/opportunities back to inquiries via inquiry_id.

CREATE INDEX IF NOT EXISTS idx_inquiries_agency_created_at
  ON inquiries(agency_id, created_at);

CREATE INDEX IF NOT EXISTS idx_inquiries_agency_source
  ON inquiries(agency_id, source);

CREATE INDEX IF NOT EXISTS idx_viewings_agency_inquiry_id
  ON viewings(agency_id, inquiry_id);

CREATE INDEX IF NOT EXISTS idx_opportunities_agency_inquiry_id
  ON opportunities(agency_id, inquiry_id);

CREATE INDEX IF NOT EXISTS idx_opportunities_agency_stage
  ON opportunities(agency_id, stage);

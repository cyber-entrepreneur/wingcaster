-- PA-FAC-002: hot-path indexes for facility detail reads.
CREATE INDEX IF NOT EXISTS idx_facility_reservations_facility_created
  ON fin.facility_reservations (facility_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_audit_facility_target
  ON fin.financial_audit_events (environment, target_type, target_id, created_at DESC)
  WHERE target_type = 'CREDIT_FACILITY';

-- PA-FAC-004: facility limit amendment lookups (open draw + audit trail).

CREATE INDEX IF NOT EXISTS idx_fin_facility_reservations_open_draw
  ON fin.facility_reservations (facility_id, environment)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_fin_financial_audit_events_facility_limit
  ON fin.financial_audit_events (environment, target_id, created_at DESC)
  WHERE target_type = 'CREDIT_FACILITY' AND action = 'FACILITY_LIMIT_AMENDED';

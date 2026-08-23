-- Stage 13e — fin.cutover_quiet_period_events (DL-217).
-- APPEND_ONLY log of 90-day quiet-period anomalies. Not a read journal:
-- only COMMERCIAL_WRITE_ATTEMPT / COMMERCIAL_READ_MISMATCH /
-- PARITY_REPORT_NON_GREEN / ATTESTATION_STALE_WARNING / OTHER.

CREATE TABLE fin.cutover_quiet_period_events (
  id UUID PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  kind TEXT NOT NULL CHECK (kind IN (
    'COMMERCIAL_WRITE_ATTEMPT',
    'COMMERCIAL_READ_MISMATCH',
    'PARITY_REPORT_NON_GREEN',
    'ATTESTATION_STALE_WARNING',
    'OTHER'
  )),
  source_file TEXT,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE fin.cutover_quiet_period_events IS
  'APPEND_ONLY Stage 13e 90-day quiet-period anomaly log (DL-217). Best-effort INSERT; never UPDATE/DELETE.';
COMMENT ON COLUMN fin.cutover_quiet_period_events.kind IS
  'COMMERCIAL_WRITE_ATTEMPT = permission denied on commercial.*; COMMERCIAL_READ_MISMATCH = fin_public shape surprise; PARITY_REPORT_NON_GREEN = post-cutover AMBER/RED; ATTESTATION_STALE_WARNING = within 7 days of expiry; OTHER = catch-all.';
COMMENT ON COLUMN fin.cutover_quiet_period_events.source_file IS
  'Caller file:line when known (e.g. billing/events.js:150).';

CREATE INDEX idx_cutover_quiet_period_events_kind_occurred
  ON fin.cutover_quiet_period_events (kind, occurred_at DESC);

CREATE INDEX idx_cutover_quiet_period_events_env_occurred
  ON fin.cutover_quiet_period_events (environment, occurred_at DESC);

CREATE OR REPLACE FUNCTION fin.trg_cutover_quiet_period_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'QUIET_PERIOD_APPEND_ONLY' USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_cutover_quiet_period_events_append_only
  BEFORE UPDATE OR DELETE ON fin.cutover_quiet_period_events
  FOR EACH ROW EXECUTE FUNCTION fin.trg_cutover_quiet_period_append_only();

ALTER TABLE fin.cutover_quiet_period_events OWNER TO fin_migrator;
ALTER FUNCTION fin.trg_cutover_quiet_period_append_only() OWNER TO fin_migrator;

ALTER TABLE fin.cutover_quiet_period_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.cutover_quiet_period_events FORCE ROW LEVEL SECURITY;

CREATE POLICY fin_migrator_all ON fin.cutover_quiet_period_events
  FOR ALL TO fin_migrator USING (true) WITH CHECK (true);

CREATE POLICY fin_quiet_period_events_insert ON fin.cutover_quiet_period_events
  FOR INSERT TO fin_app_role
  WITH CHECK (true);

CREATE POLICY fin_quiet_period_events_admin_read ON fin.cutover_quiet_period_events
  FOR SELECT TO fin_app_role, fin_finance_role, fin_auditor_role
  USING (fin.platform_admin_bypass());

CREATE POLICY fin_quiet_period_events_recon_read ON fin.cutover_quiet_period_events
  FOR SELECT TO fin_recon_role
  USING (environment = current_setting('fin.environment', true));

GRANT INSERT ON fin.cutover_quiet_period_events TO fin_app_role;
REVOKE UPDATE, DELETE, TRUNCATE ON fin.cutover_quiet_period_events FROM fin_app_role;

GRANT SELECT ON fin.cutover_quiet_period_events
  TO fin_recon_role, fin_finance_role, fin_auditor_role, fin_migrate_role;

GRANT EXECUTE ON FUNCTION fin.trg_cutover_quiet_period_append_only() TO fin_app_role;

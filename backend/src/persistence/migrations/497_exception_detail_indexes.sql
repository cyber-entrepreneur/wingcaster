-- PA-EXC-002: exception detail hot-path indexes + operator notes.
CREATE TABLE IF NOT EXISTS fin.exception_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL CHECK (environment IN ('LIVE', 'TEST')),
  exception_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) >= 1),
  wont_fix BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_actor_type TEXT,
  created_by_actor_id UUID
);

ALTER TABLE fin.exception_notes OWNER TO fin_migrator;
ALTER TABLE fin.exception_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.exception_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY fin_migrator_all ON fin.exception_notes
  FOR ALL TO fin_migrator USING (true) WITH CHECK (true);
CREATE POLICY fin_catalog_app ON fin.exception_notes
  FOR ALL TO fin_app_role USING (true) WITH CHECK (true);
CREATE POLICY fin_catalog_read ON fin.exception_notes
  FOR SELECT TO fin_finance_role, fin_auditor_role, fin_recon_role USING (true);

GRANT SELECT, INSERT ON fin.exception_notes
  TO fin_app_role, fin_recon_role, fin_finance_role, fin_auditor_role, fin_migrate_role;

CREATE INDEX IF NOT EXISTS idx_reconciliation_resolution_open_env
  ON fin.reconciliation_resolution (environment, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_dlq_env_created
  ON fin.usage_events_dlq (environment, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authorization_attempts_denied_env
  ON fin.authorization_attempts (environment, created_at DESC)
  WHERE result = 'DENIED';

CREATE INDEX IF NOT EXISTS idx_holds_expired_env
  ON fin.holds (environment, created_at DESC)
  WHERE status = 'EXPIRED';

CREATE INDEX IF NOT EXISTS idx_exception_notes_source
  ON fin.exception_notes (environment, exception_type, source_id, created_at DESC);

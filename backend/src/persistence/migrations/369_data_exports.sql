-- Self-serve data export (closes issue #192b).
--
-- GDPR Article 20 (portability) and its UAE / KSA analogues require every
-- controller to hand a user a machine-readable copy of THEIR data on
-- request. WingCaster already promised this in login copy — this table +
-- the accompanying routes make good on the promise.
--
-- Design notes:
--   - Async model: the row is created immediately on POST; a background
--     worker fills it in and flips `status` to `complete` (with
--     `file_path`, `bytes`, `sha256`) or `failed` (with `error`).
--   - `expires_at` = created_at + 7 days. Downloads past that return 410.
--     A janitor process trims disk on the same schedule.
--   - `file_path` is a filesystem path today. A future S3 migration
--     replaces this with a bucket key without touching the schema.
--   - `sha256` lets the client tamper-check the download.

CREATE TABLE IF NOT EXISTS data_exports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  file_path TEXT,
  bytes BIGINT,
  sha256 TEXT,
  error TEXT,
  requested_ip TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT data_exports_status_check CHECK (status IN ('pending', 'running', 'complete', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_exports(status)
  WHERE status IN ('pending', 'running');

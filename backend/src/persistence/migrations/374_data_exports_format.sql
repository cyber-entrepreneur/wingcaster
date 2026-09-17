-- T7 — Multi-format data export (H3 v2).
--
-- Extends the data-exports row with the requested output format so the
-- download endpoint sets the right Content-Type and the run worker
-- serializes the payload correctly.

ALTER TABLE data_exports
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'json',
  ADD CONSTRAINT data_exports_format_check CHECK (format IN ('json', 'zip'));

COMMENT ON COLUMN data_exports.format IS
  'Output format: "json" (single .json file, backward compat with H3) or "zip" (ZIP archive containing profile.json + contacts.csv + opportunities.csv + activity_log.csv + sessions.csv + backup_codes.csv + request.json).';

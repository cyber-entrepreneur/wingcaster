-- PA-DUN-005 — index write-off approval requests for admin queue reads.
CREATE INDEX IF NOT EXISTS idx_fin_approval_requests_write_off
  ON fin.approval_requests (environment, created_at DESC)
  WHERE action_kind = 'WRITE_OFF';

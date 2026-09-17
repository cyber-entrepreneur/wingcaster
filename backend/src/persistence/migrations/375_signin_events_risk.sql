-- T1 — Behavioural risk-scoring engine (H1 v2).
--
-- H1 shipped signal-baseline rules (unusual_ip, new_device, geo_hop).
-- T1 adds a richer per-attempt log so the engine can compute:
--   - Velocity: N failed attempts in the last M minutes for this user
--     or from this IP
--   - IP reputation: repeated-failure IPs → treat as attack surface
--   - Time-of-day anomaly: attempt far outside user's usual hours
--   - Geolocation stability: recent IP-country divergence
--
-- One row per sign-in attempt (success + failure). Retention is 30 days
-- for signal computation, longer for compliance if `pruned_at` is left
-- null — a follow-up worker prunes by pruned_at.

CREATE TABLE IF NOT EXISTS user_signin_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  identifier_hash TEXT,  -- sha256(lowercased email/phone) so failed-login analytics work without leaking PII
  outcome TEXT NOT NULL,  -- 'success' | 'password_fail' | 'mfa_fail' | 'blocked_by_policy'
  ip TEXT,
  ip_country TEXT,
  user_agent TEXT,
  risk_score INTEGER,  -- 0-100 when the T1 engine ran, else NULL
  risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pruned_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT user_signin_events_outcome_check
    CHECK (outcome IN ('success', 'password_fail', 'mfa_fail', 'blocked_by_policy'))
);

CREATE INDEX IF NOT EXISTS idx_user_signin_events_user_recent
  ON user_signin_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_signin_events_ip_recent
  ON user_signin_events(ip, created_at DESC)
  WHERE ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_signin_events_identifier_recent
  ON user_signin_events(identifier_hash, created_at DESC)
  WHERE identifier_hash IS NOT NULL;

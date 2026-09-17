-- H1 hardening of the agency MFA policy (#194 v2).
--
-- Extends `agency_mfa_policy` (migration 367) with the enterprise-grade
-- controls Okta / Google Workspace / Microsoft Entra ship:
--
--   1. Group scoping — different policies for different roles (owner vs
--      admin vs agent). Enterprise IT wants contractors on stricter rules
--      than trusted admins.
--   2. Bypass list — specific user ids exempted (service accounts, break-
--      glass admin recovery).
--   3. Conditional rules — require MFA when signal fires (unusual IP,
--      new device, impossible geo hop). Stored as JSONB rules so the set
--      can grow without a schema change.
--   4. Grace-behaviour toggle (enforce_on_next_login vs enforce_at_deadline
--      — some tenants want an immediate lockout on a new hire's next login
--      so IT can walk them through enrollment on day one).
--
-- Backwards-compatible: all fields default to values that reproduce
-- migration 367's behaviour, so existing rows keep working.

ALTER TABLE agency_mfa_policy
  ADD COLUMN IF NOT EXISTS scoped_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bypass_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS conditional_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS enforce_on_next_login BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN agency_mfa_policy.scoped_roles IS
  'When non-empty, the policy applies ONLY to members whose role is in this array. Empty = applies to all members.';
COMMENT ON COLUMN agency_mfa_policy.bypass_user_ids IS
  'Users exempted from enforcement even when the policy otherwise applies. Used for service accounts and break-glass admin recovery.';
COMMENT ON COLUMN agency_mfa_policy.conditional_rules IS
  'Extra conditions that also require enrolled MFA. Each rule is {kind, params}: kind ∈ {unusual_ip, new_device, impossible_geo_hop}.';
COMMENT ON COLUMN agency_mfa_policy.enforce_on_next_login IS
  'When true, non-enrolled members are blocked at their next sign-in (no grace applied even if grace_days > 0).';

-- Signal cache — persist observed sign-in signals (IPs, device fingerprints)
-- so conditional rules can detect "new" vs "seen before" without an external
-- fraud-detection service.
CREATE TABLE IF NOT EXISTS user_signin_signals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_kind TEXT NOT NULL,
  signal_value TEXT NOT NULL,
  ip_country TEXT,
  ip_city TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT user_signin_signals_kind_check CHECK (signal_kind IN ('ip', 'device_fingerprint'))
);

CREATE INDEX IF NOT EXISTS idx_user_signin_signals_lookup
  ON user_signin_signals(user_id, signal_kind, signal_value);
CREATE INDEX IF NOT EXISTS idx_user_signin_signals_last_seen
  ON user_signin_signals(user_id, last_seen_at DESC);

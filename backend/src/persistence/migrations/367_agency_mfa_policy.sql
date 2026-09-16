-- Admin-enforced 2FA policy per agency (closes issue #190).
--
-- Enterprise identity providers (Okta, Google Workspace, Microsoft 365) expose
-- a per-tenant policy that says "all members MUST enroll in 2FA within N days
-- or sign-in is blocked." That's the SOC 2 / ISO 27001 control this table
-- implements for WingCaster.
--
-- One row per agency. Absence = "no policy set" (policy defaults to
-- required=false, i.e. member choice). PUT upserts; DELETE would reset to
-- default but we prefer keeping the audit trail on the row.
--
-- History:
--   allowed_factors is JSONB so passkey (#189), SMS-fallback, and future
--   factors can be added without a schema change. Empty array means "all
--   supported factors accepted." A future admin toggle could restrict to
--   {"totp"} (block passkey), {"passkey"} (require passkey), etc.

CREATE TABLE IF NOT EXISTS agency_mfa_policy (
  agency_id TEXT PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  required BOOLEAN NOT NULL DEFAULT false,
  grace_days INTEGER NOT NULL DEFAULT 14,
  allowed_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Sanity: grace_days should stay bounded so a typo cannot lock or unlock
  -- an agency for a year. 0 = "must enroll before next sign-in" (no grace).
  CONSTRAINT agency_mfa_policy_grace_days_bounds CHECK (grace_days BETWEEN 0 AND 90)
);

-- Lookup by agency is the only access pattern (PK covers it). No secondary
-- index needed.

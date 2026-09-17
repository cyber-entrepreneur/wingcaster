-- WebAuthn / passkey credentials (closes issue #189).
--
-- Adds passkey enrollment + sign-in as a phishing-resistant second factor
-- alongside the existing TOTP + backup-code path (Phase 7f/1). Enterprise
-- identity providers (Okta, Google Workspace, Microsoft Entra, 1Password
-- Business) all ship passkeys as the primary factor now — this is the
-- table-stakes control WingCaster was missing.
--
-- One user can register many credentials (laptop Touch ID + phone Face ID
-- + hardware key) and use any of them to sign in.
--
-- Design notes:
--   - `credential_id` is the raw byte-array credential id returned by the
--     authenticator, stored base64url-encoded (matches @simplewebauthn/server
--     canonical format).
--   - `public_key` is COSE-encoded, base64url. Signature verification uses
--     it as-is.
--   - `sign_count` (aka signature counter) is bumped on every successful
--     authentication. A stale counter is one signal of a cloned credential
--     — checking is optional per WebAuthn L2 but recommended.
--   - `transports` is JSONB so future hint categories (`hybrid`, `internal`
--     + `usb` + `nfc` + `ble`) can be stored without a schema change.
--   - `last_used_at` powers "last used ~3 days ago" copy on the settings
--     surface + a nudge to remove credentials that have not been used in
--     over a year.
--   - `backup_eligible` + `backup_state`: authenticator hints from L3 spec.
--     If a credential is `backup_eligible=true`, it can be synced across
--     the user's devices (iCloud Keychain, Google Password Manager); we
--     surface that in the UI so users understand why a passkey enrolled
--     on their phone works on their laptop.

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  sign_count BIGINT NOT NULL DEFAULT 0,
  transports JSONB NOT NULL DEFAULT '[]'::jsonb,
  device_type TEXT,
  backup_eligible BOOLEAN NOT NULL DEFAULT false,
  backup_state BOOLEAN NOT NULL DEFAULT false,
  aaguid TEXT,
  name TEXT NOT NULL DEFAULT 'Passkey',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webauthn_credentials_credential_id ON webauthn_credentials(credential_id);

-- Short-lived challenge storage. The authenticator MUST sign the exact
-- challenge that the server generated for THIS request — so we persist it
-- per-user and rotate on every begin call.
--
-- Kept in a separate table (not a Redis / in-memory cache) so a multi-node
-- deployment can serve /register/begin and /register/complete from
-- different processes without a session-affinity requirement.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT webauthn_challenges_purpose_check CHECK (purpose IN ('register', 'authenticate'))
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_id ON webauthn_challenges(user_id, purpose);

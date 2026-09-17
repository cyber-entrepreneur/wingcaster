-- H4 hardening of WebAuthn / passkeys (#197 v2).
--
-- Adds the enterprise-grade attestation controls Okta FastPass / Microsoft
-- Entra passwordless / 1Password Business ship:
--
--   1. Record attestation metadata on every credential so admins can see
--      "iPhone Face ID" vs "YubiKey Bio Series X" instead of an opaque
--      "Passkey" — driven off aaguid + FIDO MDS lookup.
--   2. Per-agency policy toggles: require attestation, allow/deny specific
--      authenticator models (block a known-fake YubiKey clone or force
--      hardware-backed only).
--   3. Cache the FIDO Metadata Service BLOB so lookups don't hit the FIDO
--      Alliance server on every registration.

-- Extend the credentials table with attestation results.
ALTER TABLE webauthn_credentials
  ADD COLUMN IF NOT EXISTS attestation_format TEXT,
  ADD COLUMN IF NOT EXISTS attestation_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mds_metadata JSONB;

COMMENT ON COLUMN webauthn_credentials.attestation_format IS
  'The COSE attestation statement format ("packed", "tpm", "android-safetynet", "apple", "none"). null when H4 not enabled.';
COMMENT ON COLUMN webauthn_credentials.attestation_verified IS
  'True when attestation was verified with a certificate chain rooted in the FIDO MDS. Never set true when attestationFormat=none.';
COMMENT ON COLUMN webauthn_credentials.mds_metadata IS
  'Snapshot of the FIDO Metadata Statement for this AAGUID at registration time (authenticator name, icon, capabilities).';

-- Extend the agency policy with passkey-specific admin knobs.
ALTER TABLE agency_mfa_policy
  ADD COLUMN IF NOT EXISTS webauthn_require_attestation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webauthn_allowed_aaguids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS webauthn_denied_aaguids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN agency_mfa_policy.webauthn_require_attestation IS
  'When true, passkey registrations MUST supply verifiable attestation. Blocks Apple Passkey (attestationType=none) unless explicitly allowed via aaguid allowlist.';
COMMENT ON COLUMN agency_mfa_policy.webauthn_allowed_aaguids IS
  'When non-empty, only authenticators with these AAGUIDs may register. Empty = all AAGUIDs allowed.';
COMMENT ON COLUMN agency_mfa_policy.webauthn_denied_aaguids IS
  'AAGUIDs explicitly blocked (e.g. known-fake authenticator vendors). Denylist wins over allowlist.';

-- FIDO Metadata Service BLOB cache — one row keyed by AAGUID.
CREATE TABLE IF NOT EXISTS fido_mds_metadata (
  aaguid TEXT PRIMARY KEY,
  metadata JSONB NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fido_mds_metadata_refreshed
  ON fido_mds_metadata(refreshed_at);

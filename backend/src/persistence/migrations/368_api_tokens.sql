-- Personal Access Tokens (closes issue #192a).
--
-- Enterprise integrations need a scoped, revocable credential that agents
-- can paste into their CRM / BI / automation tool. Session JWTs are user-
-- interactive only (short-lived, tied to a browser); PATs are the machine-
-- to-machine story.
--
-- Design notes:
--   - `hashed_secret` is sha256(raw_token). We never store or return the
--     plaintext after creation.
--   - `scopes` is JSONB so the surface can grow without a schema change.
--     Empty array = "same permissions as the owning user."
--   - `expires_at` is nullable — never-expiring tokens are allowed but the
--     UI should nudge admins to set one.
--   - `revoked_at` is a soft delete. Authentication checks
--     `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`.
--   - `last_used_at` updated lazily by the bearer middleware (fire-and-forget
--     UPDATE, not on the auth critical path).

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_id TEXT REFERENCES agencies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  hashed_secret TEXT NOT NULL UNIQUE,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Common queries: list a user's tokens (revoked or not, sorted newest first)
-- and lookup by hash on every authenticated request. Both need an index.
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_tokens_hashed_secret ON api_tokens(hashed_secret);

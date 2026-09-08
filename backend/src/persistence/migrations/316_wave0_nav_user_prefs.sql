-- Wave 0 nav chrome: active tenant, preferred locale, optional username,
-- and OAuth identity links for google / apple / facebook sign-in.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT;

UPDATE users
SET preferred_locale = 'en'
WHERE preferred_locale IS NULL;

ALTER TABLE users
  ALTER COLUMN preferred_locale SET DEFAULT 'en';

ALTER TABLE users
  ALTER COLUMN preferred_locale SET NOT NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_preferred_locale_check;
ALTER TABLE users
  ADD CONSTRAINT users_preferred_locale_check
  CHECK (preferred_locale IN ('en', 'ar'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower
  ON users (lower(username))
  WHERE username IS NOT NULL AND btrim(username) <> '';

CREATE INDEX IF NOT EXISTS idx_users_active_tenant_id
  ON users (active_tenant_id);

-- Best-effort backfill from JSONB; skip colliding usernames.
UPDATE users u
SET username = NULLIF(btrim(u.data->>'username'), '')
WHERE u.username IS NULL
  AND NULLIF(btrim(u.data->>'username'), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users other
    WHERE other.id <> u.id
      AND other.username IS NOT NULL
      AND lower(other.username) = lower(btrim(u.data->>'username'))
  )
  AND (
    SELECT COUNT(*)
    FROM users twin
    WHERE twin.id <> u.id
      AND twin.username IS NULL
      AND lower(NULLIF(btrim(twin.data->>'username'), '')) = lower(btrim(u.data->>'username'))
  ) = 0;

CREATE TABLE IF NOT EXISTS auth_oauth_identities (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple', 'facebook')),
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_auth_oauth_provider_subject UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_oauth_identities_user
  ON auth_oauth_identities (user_id);

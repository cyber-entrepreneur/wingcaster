-- SHR-ERR-005 — Maintenance / degraded status notices.
--
-- Platform-wide incident/maintenance banners shown atop every screen. A
-- platform admin publishes a notice (planned maintenance window, a degraded
-- subsystem, or a plain informational note); the public GET /api/status
-- endpoint returns the currently-live notices and the global banner
-- (PlatformStatusBanner) polls it every 60s to surface them to every user.
--
-- `status` doubles as the severity: info < degraded < maintenance. The
-- optional starts_at/ends_at window lets an admin schedule a notice ahead of
-- time; a row only surfaces publicly while active AND inside its window.
CREATE TABLE IF NOT EXISTS platform_status_notices (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  learn_more_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,          -- notice is hidden before this time; NULL = immediately
  ends_at TIMESTAMPTZ,            -- notice is hidden after this time; NULL = until resolved
  created_by TEXT,               -- platform-admin user id who published it
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT platform_status_notices_status_check
    CHECK (status IN ('info', 'degraded', 'maintenance'))
);

-- The public banner's hot path: active notices, newest first.
CREATE INDEX IF NOT EXISTS idx_platform_status_notices_active
  ON platform_status_notices(active, created_at DESC)
  WHERE active = true;

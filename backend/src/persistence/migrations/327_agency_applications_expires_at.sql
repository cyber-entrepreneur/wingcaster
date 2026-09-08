-- BE-BLOCKER-09 / Wave 0.5 — agency application 30-day expiry.
-- File: 327_agency_applications_expires_at.sql
--
-- Parallel Agent 1 (BE-06, migration 324) promotes agency_applications from
-- legacy_collections to a first-class table. This migration is defensive:
--   * CREATE a minimal compatible table if 324 has not landed yet
--   * ADD expires_at when the table already exists
--   * Backfill expires_at = created_at + 30 days
--   * Dual-read safety: also stamp expires_at into legacy_collections JSON
-- Idempotent: safe to re-run.

-- Minimal uplift table (compatible column names with BE-06). IF NOT EXISTS so
-- 324 can still add remaining columns when it lands after this migration.
CREATE TABLE IF NOT EXISTS public.agency_applications (
  id TEXT PRIMARY KEY,
  agency_id TEXT,
  agent_email TEXT,
  agent_name TEXT,
  agent_phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_role TEXT,
  affiliation_mode TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'agency_applications'
  ) THEN
    ALTER TABLE public.agency_applications
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

    -- Ensure new inserts get a 30-day window even when the caller omits the field.
    ALTER TABLE public.agency_applications
      ALTER COLUMN expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days');

    UPDATE public.agency_applications
       SET expires_at = COALESCE(created_at, CURRENT_TIMESTAMP) + INTERVAL '30 days'
     WHERE expires_at IS NULL;

    -- Promote to NOT NULL once every row is filled (no-op if already NOT NULL).
    IF NOT EXISTS (
      SELECT 1 FROM public.agency_applications WHERE expires_at IS NULL
    ) THEN
      ALTER TABLE public.agency_applications
        ALTER COLUMN expires_at SET NOT NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agency_applications_pending_expires_at
  ON public.agency_applications (expires_at)
  WHERE status = 'pending';

-- Dual-read safety during the BE-06 merge window: stamp expires_at into
-- legacy_collections JSON for any rows still living there.
UPDATE public.legacy_collections
   SET data = jsonb_set(
         data,
         '{expires_at}',
         to_jsonb(
           (COALESCE(created_at, CURRENT_TIMESTAMP) + INTERVAL '30 days')
         ),
         true
       ),
       updated_at = CURRENT_TIMESTAMP
 WHERE collection = 'agency_applications'
   AND (
     NOT (data ? 'expires_at')
     OR data->>'expires_at' IS NULL
     OR btrim(data->>'expires_at') = ''
   );

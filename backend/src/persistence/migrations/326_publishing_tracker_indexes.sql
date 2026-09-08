-- BE-BLOCKER-11 / WF-03 Agent 3 — publishing tracker list + summary.
-- Keyset indexes for GET /api/publishing/tracker (cursor-paginated ledger).
-- Idempotent: CREATE INDEX IF NOT EXISTS. Do not use 325 or 327.
--
-- submitted_at is NOT a stored column. Tracker SQL uses
--   COALESCE(distribution_jobs.published_at, distribution_jobs.created_at,
--            distribution_attempts.attempted_at)
-- so the job-side indexes cover COALESCE(published_at, created_at).

CREATE INDEX IF NOT EXISTS idx_distribution_jobs_agent_submitted_at
  ON public.distribution_jobs (agent_id, (COALESCE(published_at, created_at)) DESC)
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distribution_jobs_agency_submitted_at
  ON public.distribution_jobs (agency_id, (COALESCE(published_at, created_at)) DESC)
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distribution_jobs_platform_status
  ON public.distribution_jobs (platform, status);

CREATE INDEX IF NOT EXISTS idx_distribution_attempts_job_attempted_at
  ON public.distribution_attempts (distribution_job_id, attempted_at DESC);

COMMENT ON INDEX public.idx_distribution_jobs_agent_submitted_at IS
  'BE-BLOCKER-11 tracker keyset: agent_id + submitted_at expression COALESCE(published_at, created_at)';

COMMENT ON INDEX public.idx_distribution_jobs_agency_submitted_at IS
  'BE-BLOCKER-11 tracker keyset: agency_id / tenant equivalent + submitted_at expression';

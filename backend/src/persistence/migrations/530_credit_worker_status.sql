-- PA-CRD-008 / PA-CRD-009 — persisted last-run metadata for credit worker admin surfaces.

CREATE TABLE IF NOT EXISTS public.credit_worker_status (
  worker_name TEXT PRIMARY KEY CHECK (worker_name IN ('CREDITS_JANITOR', 'CREDITS_FIN_MIRROR')),
  last_run_at TIMESTAMPTZ,
  last_processed_count INTEGER NOT NULL DEFAULT 0,
  last_skip_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_worker_status_updated
  ON public.credit_worker_status (updated_at DESC);

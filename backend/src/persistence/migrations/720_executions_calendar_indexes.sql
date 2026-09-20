-- Wave 2B — covering indexes for the publishing control plane / content calendar.
-- Hot paths: agency calendar by scheduled_at, status×schedule scans, campaign + date.
-- Additive only; idempotent.

CREATE INDEX IF NOT EXISTS idx_executions_agency_scheduled_at
  ON public.executions (agency_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_executions_status_scheduled_at
  ON public.executions (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_executions_agency_kind_scheduled_at
  ON public.executions (agency_id, kind, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_executions_agency_campaign_scheduled_at
  ON public.executions (agency_id, campaign_id, scheduled_at)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_executions_agency_subject_scheduled_at
  ON public.executions (agency_id, subject_type, subject_id, scheduled_at)
  WHERE subject_id IS NOT NULL;

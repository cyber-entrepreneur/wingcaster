-- Wave 8 enterprise follow-up: tenant-scoped audit_log for SIEM / portal traces.
-- Additive only. Existing rows keep NULL tenant_id; new bulk writes populate it.
-- Type is TEXT (not UUID) to match tenants.id / tenant_memberships.tenant_id
-- (values are "personal:<id>" / "agency:<id>").

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created
  ON public.audit_log (tenant_id, created_at DESC);

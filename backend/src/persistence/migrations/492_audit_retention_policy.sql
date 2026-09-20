-- PA-AUD-002 — Audit-log retention policy.
--
-- Until now the retention purge (POST /api/admin/audit-log/retention) used
-- hardcoded env constants (AUDIT_LOG_RETENTION_DAYS / ACTIVITY_LOG_RETENTION_DAYS).
-- This table makes retention configurable per event category, with an
-- export-before-purge flag. A single row (id = 'default') holds the platform
-- policy; the purge job reads it (falling back to the env defaults when unset).
--
-- Regulatory floor: financial audit rows must be kept >= 7 years (2555 days);
-- enforced in the route and mirrored by a CHECK here.

CREATE TABLE IF NOT EXISTS public.audit_retention_policy (
  id TEXT PRIMARY KEY,
  financial_actions_days INTEGER NOT NULL DEFAULT 2555,
  pa_actions_days INTEGER NOT NULL DEFAULT 365,
  tenant_actions_days INTEGER NOT NULL DEFAULT 365,
  system_events_days INTEGER NOT NULL DEFAULT 90,
  export_before_purge BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_retention_financial_floor CHECK (financial_actions_days >= 2555),
  CONSTRAINT audit_retention_financial_max CHECK (financial_actions_days <= 3650),
  CONSTRAINT audit_retention_pa_bounds CHECK (pa_actions_days BETWEEN 30 AND 3650),
  CONSTRAINT audit_retention_tenant_bounds CHECK (tenant_actions_days BETWEEN 30 AND 3650),
  CONSTRAINT audit_retention_system_bounds CHECK (system_events_days BETWEEN 30 AND 3650)
);

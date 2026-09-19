-- AGN-CRD-004 — Standing credit allocation rules per agency.
--
-- One policy row per agency defines how future top-ups are distributed:
-- manual (allocate on each top-up), automatic percentage, per-agent cap,
-- or hybrid. Per-agent overrides live in a child table so percentage sums
-- and caps can be validated independently of the mode toggle.

CREATE TABLE IF NOT EXISTS agency_credit_allocation_rules (
  agency_id TEXT PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'manual',
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT agency_credit_allocation_rules_mode_check
    CHECK (mode IN ('manual', 'percentage', 'cap_per_agent', 'hybrid'))
);

CREATE TABLE IF NOT EXISTS agency_credit_allocation_overrides (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  agent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percentage NUMERIC(5, 2),
  cap_usd NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT agency_credit_allocation_overrides_agency_agent_unique
    UNIQUE (agency_id, agent_user_id),
  CONSTRAINT agency_credit_allocation_overrides_percentage_bounds
    CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
  CONSTRAINT agency_credit_allocation_overrides_cap_positive
    CHECK (cap_usd IS NULL OR cap_usd > 0)
);

CREATE INDEX IF NOT EXISTS idx_agency_credit_allocation_overrides_agency
  ON agency_credit_allocation_overrides(agency_id);

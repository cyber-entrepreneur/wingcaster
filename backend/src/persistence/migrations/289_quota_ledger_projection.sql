-- Quota allowance ledger (DL-243 / formerly DL-226 option a).
-- Independent of the retired legacy billing surface. Greenfield installs
-- create quota.ledger_entries directly — there is no historical copy step
-- because no live clients exist.

CREATE SCHEMA IF NOT EXISTS quota;

COMMENT ON SCHEMA quota IS
  'Quota allowance ledger (DL-243). Per-tenant per-quota-key per-period. Independent of fin.* rated_usage.';

CREATE TABLE IF NOT EXISTS quota.ledger_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subscription_id TEXT,
  billing_period VARCHAR(10) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN
    ('allowance_grant','consumption','overage','topup','adjustment')),
  quota_key VARCHAR(80) NOT NULL,
  amount NUMERIC(15,4) NOT NULL,
  source_event_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_quota_ledger_entries_tenant_quota_period
  ON quota.ledger_entries(tenant_id, quota_key, billing_period);

CREATE INDEX IF NOT EXISTS idx_quota_ledger_entries_period
  ON quota.ledger_entries(billing_period);

CREATE OR REPLACE FUNCTION quota.record_consumption(
  p_tenant_id TEXT,
  p_subscription_id TEXT,
  p_billing_period TEXT,
  p_quota_key TEXT,
  p_amount NUMERIC,
  p_source_event_id TEXT,
  p_metadata JSONB
) RETURNS TABLE(within_allowance NUMERIC, overage NUMERIC, entry_ids TEXT[])
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance NUMERIC;
  v_amount NUMERIC := GREATEST(0, COALESCE(p_amount, 0));
  v_within NUMERIC;
  v_overage NUMERIC;
  v_entry_ids TEXT[] := ARRAY[]::TEXT[];
  v_entry_id TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id || p_quota_key || p_billing_period));

  SELECT COALESCE(SUM(amount), 0)
    INTO v_balance
    FROM quota.ledger_entries
   WHERE tenant_id = p_tenant_id
     AND quota_key = p_quota_key
     AND billing_period = p_billing_period;

  v_within := LEAST(v_amount, GREATEST(0, v_balance));
  v_overage := v_amount - v_within;

  IF v_within > 0 THEN
    INSERT INTO quota.ledger_entries (
      id, tenant_id, subscription_id, billing_period, type, quota_key,
      amount, source_event_id, metadata
    ) VALUES (
      gen_random_uuid()::TEXT, p_tenant_id, p_subscription_id,
      p_billing_period, 'consumption', p_quota_key, -v_within,
      p_source_event_id, COALESCE(p_metadata, '{}'::JSONB)
    ) RETURNING id INTO v_entry_id;
    v_entry_ids := array_append(v_entry_ids, v_entry_id);
  END IF;

  IF v_overage > 0 THEN
    INSERT INTO quota.ledger_entries (
      id, tenant_id, subscription_id, billing_period, type, quota_key,
      amount, source_event_id, metadata
    ) VALUES (
      gen_random_uuid()::TEXT, p_tenant_id, p_subscription_id,
      p_billing_period, 'overage', p_quota_key, -v_overage,
      p_source_event_id,
      COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object('overage_units', v_overage)
    ) RETURNING id INTO v_entry_id;
    v_entry_ids := array_append(v_entry_ids, v_entry_id);
  END IF;

  RETURN QUERY SELECT v_within, v_overage, v_entry_ids;
END;
$$;

ALTER TABLE quota.ledger_entries OWNER TO fin_migrator;
ALTER FUNCTION quota.record_consumption OWNER TO fin_migrator;

GRANT USAGE ON SCHEMA quota TO fin_app_role, fin_recon_role, fin_finance_role, fin_auditor_role, fin_migrate_role;
GRANT SELECT, INSERT ON quota.ledger_entries TO fin_app_role, fin_migrate_role;
GRANT SELECT ON quota.ledger_entries TO fin_recon_role, fin_finance_role, fin_auditor_role;
GRANT EXECUTE ON FUNCTION quota.record_consumption TO fin_app_role, fin_migrate_role;

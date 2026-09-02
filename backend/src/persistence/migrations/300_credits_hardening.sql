-- PR A — enterprise credit engine (hot-path public.* + fin.* mirror support).
-- Deviations from the Cursor spec are commented inline.

-- ---------------------------------------------------------------------------
-- Helper: deterministic UUID for wallets that have no fin.tenants row.
-- Same algorithm as backend/src/lib/credits/wallets.js syntheticTenantId().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_synthetic_tenant_id(scope text, scope_id text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    substr(md5($1 || ':' || $2), 1, 8) || '-' ||
    substr(md5($1 || ':' || $2), 9, 4) || '-' ||
    '5' || substr(md5($1 || ':' || $2), 13, 3) || '-' ||
    '8' || substr(md5($1 || ':' || $2), 17, 3) || '-' ||
    substr(md5($1 || ':' || $2), 21, 12)
  )::uuid
$$;

CREATE TABLE public.credit_wallets (
  tenant_id UUID PRIMARY KEY,
  currency CHAR(3) NOT NULL,
  credits_remaining BIGINT NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
  credits_reserved BIGINT NOT NULL DEFAULT 0 CHECK (credits_reserved >= 0),
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1,
  -- Deviation: scope/scope_id keep the whatsapp-listings (agent|agency, id)
  -- addressing scheme so callers do not require a fin.tenants row.
  scope TEXT,
  scope_id TEXT,
  fin_tenant_id UUID REFERENCES fin.tenants(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (credits_reserved <= credits_remaining)
);

CREATE UNIQUE INDEX uq_credit_wallets_scope_scope_id
  ON public.credit_wallets (scope, scope_id)
  WHERE scope IS NOT NULL AND scope_id IS NOT NULL;

CREATE TABLE public.credit_grants (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.credit_wallets(tenant_id),
  source TEXT NOT NULL CHECK (source IN (
    'subscription_cycle', 'topup.stripe', 'topup.paddle',
    'topup.manual_receipt_omt', 'topup.manual_receipt_whish',
    'topup.manual_receipt_monty', 'topup.manual_receipt_bank_transfer',
    'topup.manual_receipt_paypal', 'promo', 'goodwill',
    'migration', 'facility_draw', 'adjustment.correction'
  )),
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  grant_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  package_id UUID,
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by_actor_type TEXT,
  granted_by_actor_id UUID,
  approval_request_id UUID REFERENCES fin.approval_requests(id),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX uq_credit_grants_ref_source
  ON public.credit_grants ((grant_ref->>'idempotency_key'), source)
  WHERE grant_ref->>'idempotency_key' IS NOT NULL;

CREATE TABLE public.credit_consumptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.credit_wallets(tenant_id),
  feature TEXT NOT NULL,
  call_type TEXT NOT NULL,
  request_id TEXT NOT NULL,
  credits_amount BIGINT NOT NULL CHECK (credits_amount > 0),
  actual_cost_micro_usd BIGINT,
  provider TEXT,
  model TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  reservation_id UUID,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, request_id, feature, call_type)
);

CREATE TABLE public.credit_reservations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.credit_wallets(tenant_id),
  feature TEXT NOT NULL,
  request_id TEXT NOT NULL,
  credits_amount BIGINT NOT NULL CHECK (credits_amount > 0),
  status TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, request_id, feature)
);

CREATE TABLE public.credit_spend_caps (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.credit_wallets(tenant_id),
  feature TEXT,
  window_kind TEXT NOT NULL CHECK (window_kind IN ('MINUTE', 'HOUR', 'DAY', 'WEEK', 'MONTH')),
  max_credits BIGINT NOT NULL CHECK (max_credits > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_grants_tenant_granted
  ON public.credit_grants (tenant_id, granted_at DESC);
CREATE INDEX idx_credit_consumptions_tenant_consumed
  ON public.credit_consumptions (tenant_id, consumed_at DESC);
CREATE INDEX idx_credit_consumptions_feature
  ON public.credit_consumptions (feature, consumed_at DESC);
CREATE INDEX idx_credit_reservations_expiring
  ON public.credit_reservations (status, expires_at)
  WHERE status = 'HELD';
CREATE INDEX idx_credit_spend_caps_tenant
  ON public.credit_spend_caps (tenant_id, active)
  WHERE active = true;

-- Deviation: spec named fin.reconciliation_notes which did not exist.
CREATE TABLE fin.reconciliation_notes (
  id UUID PRIMARY KEY,
  note TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE fin.reconciliation_notes OWNER TO fin_migrator;
ALTER TABLE fin.reconciliation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.reconciliation_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY fin_migrator_all ON fin.reconciliation_notes
  FOR ALL TO fin_migrator USING (true) WITH CHECK (true);
CREATE POLICY fin_catalog_app ON fin.reconciliation_notes
  FOR ALL TO fin_app_role USING (true) WITH CHECK (true);
CREATE POLICY fin_catalog_read ON fin.reconciliation_notes
  FOR SELECT TO fin_finance_role, fin_auditor_role, fin_recon_role USING (true);

GRANT SELECT, INSERT ON fin.reconciliation_notes
  TO fin_app_role, fin_recon_role, fin_finance_role, fin_auditor_role, fin_migrate_role;

-- Multi-currency: grants must match the wallet currency.
CREATE OR REPLACE FUNCTION public.trg_credit_grants_currency_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  wallet_ccy CHAR(3);
BEGIN
  SELECT currency INTO wallet_ccy
    FROM public.credit_wallets
   WHERE tenant_id = NEW.tenant_id;
  IF wallet_ccy IS NULL THEN
    RAISE EXCEPTION 'CURRENCY_MISMATCH: wallet % does not exist', NEW.tenant_id
      USING ERRCODE = '23514';
  END IF;
  IF wallet_ccy IS DISTINCT FROM NEW.currency THEN
    RAISE EXCEPTION 'CURRENCY_MISMATCH: grant currency % != wallet currency %',
      NEW.currency, wallet_ccy
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_grants_currency_match
  BEFORE INSERT ON public.credit_grants
  FOR EACH ROW EXECUTE FUNCTION public.trg_credit_grants_currency_match();

-- Approval-threshold trigger
CREATE OR REPLACE FUNCTION public.trg_credit_grants_require_approval()
  RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  threshold_micro_usd BIGINT :=
    COALESCE(NULLIF(current_setting('credits.approval_threshold_micro_usd', true), '')::bigint, 10000000);
  per_credit_micro_usd BIGINT :=
    COALESCE(NULLIF(current_setting('credits.per_credit_micro_usd', true), '')::bigint, 100);
  cost_micro_usd BIGINT := NEW.amount * per_credit_micro_usd;
BEGIN
  IF NEW.source IN ('adjustment.correction', 'goodwill')
     AND cost_micro_usd > threshold_micro_usd
     AND NEW.approval_request_id IS NULL THEN
    RAISE EXCEPTION 'CREDIT_GRANT_APPROVAL_REQUIRED: source=% amount=% micro_usd=% threshold=%',
      NEW.source, NEW.amount, cost_micro_usd, threshold_micro_usd;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_grants_require_approval
  BEFORE INSERT ON public.credit_grants
  FOR EACH ROW EXECUTE FUNCTION public.trg_credit_grants_require_approval();

-- ---------------------------------------------------------------------------
-- Append-only enforcement.
-- Deviation: roles on main are fin_app_role / fin_migrator, not wingcaster_*.
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE, TRUNCATE ON public.credit_grants FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON public.credit_consumptions FROM PUBLIC;
REVOKE DELETE, TRUNCATE ON public.credit_wallets FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO fin_app_role, fin_recon_role, fin_finance_role, fin_auditor_role;

GRANT SELECT, INSERT, UPDATE ON public.credit_wallets TO fin_app_role;
GRANT SELECT, INSERT ON public.credit_grants TO fin_app_role;
GRANT SELECT, INSERT ON public.credit_consumptions TO fin_app_role;
GRANT SELECT, INSERT, UPDATE ON public.credit_reservations TO fin_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_spend_caps TO fin_app_role;

REVOKE UPDATE, DELETE, TRUNCATE ON public.credit_grants FROM fin_app_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.credit_consumptions FROM fin_app_role;
REVOKE DELETE, TRUNCATE ON public.credit_wallets FROM fin_app_role;

GRANT SELECT ON public.credit_wallets, public.credit_grants, public.credit_consumptions,
  public.credit_reservations, public.credit_spend_caps
  TO fin_recon_role, fin_finance_role, fin_auditor_role, fin_migrate_role;

-- ---------------------------------------------------------------------------
-- fin.* mirror support: new shapes + revenue account types.
-- Spec asked for GRANT_MIRROR / CONSUME_MIRROR and DEFERRED_REVENUE /
-- RECOGNIZED_REVENUE which did not exist on main. Added here (new migration,
-- not a rewrite of 102/103).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'fin.ledger_accounts'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%account_type%'
  LOOP
    EXECUTE format('ALTER TABLE fin.ledger_accounts DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE fin.ledger_accounts
  ADD CONSTRAINT ledger_accounts_account_type_check
  CHECK (account_type IN (
    'AVAILABLE', 'HELD', 'ISSUANCE', 'CONSUMED', 'EXPIRED', 'ADJUSTMENT', 'CLEARING',
    'DEFERRED_REVENUE', 'RECOGNIZED_REVENUE'
  ));

INSERT INTO fin.ledger_accounts (
  id, environment, book_id, account_type, created_at, updated_at
)
SELECT gen_random_uuid(), b.environment, b.id, t.account_type, NOW(), NOW()
  FROM fin.ledger_books b
  CROSS JOIN (VALUES ('DEFERRED_REVENUE'), ('RECOGNIZED_REVENUE')) AS t(account_type)
ON CONFLICT (book_id, account_type) DO NOTHING;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'fin.ledger_transactions'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%shape%'
       AND conname NOT LIKE 'chk_pair%'
  LOOP
    EXECUTE format('ALTER TABLE fin.ledger_transactions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE fin.ledger_transactions
  ADD CONSTRAINT ledger_transactions_shape_check
  CHECK (shape IN (
    'FUNDING', 'HOLD', 'VOID', 'CAPTURE', 'DIRECT_SPEND', 'EXPIRY',
    'REFUND', 'ADJUSTMENT', 'TRANSFER', 'GRANT', 'MIGRATE',
    'GRANT_MIRROR', 'CONSUME_MIRROR'
  ));

DROP INDEX IF EXISTS fin.uq_ledger_tx_once_per_source_shape;
CREATE UNIQUE INDEX uq_ledger_tx_once_per_source_shape
  ON fin.ledger_transactions (environment, economic_source_type, economic_source_id, shape)
  WHERE shape IN (
    'FUNDING', 'HOLD', 'VOID', 'CAPTURE', 'DIRECT_SPEND',
    'EXPIRY', 'GRANT', 'MIGRATE', 'GRANT_MIRROR', 'CONSUME_MIRROR'
  );

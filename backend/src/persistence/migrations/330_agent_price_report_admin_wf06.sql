-- BE-BLOCKER-26 / WF-06 PA-PVA-009 — agent price report admin bundle.
-- Prefer 318 was taken (conversations_channel_source_split); this is next free.
-- Idempotent. Do not renumber.

-- ---------------------------------------------------------------------------
-- Expand agent_price_reports status vocabulary + PA queue columns
-- ---------------------------------------------------------------------------
UPDATE market_pricing.agent_price_reports
   SET status = 'pending_review'
 WHERE status = 'pending';

ALTER TABLE market_pricing.agent_price_reports
  DROP CONSTRAINT IF EXISTS agent_price_reports_status_check;

ALTER TABLE market_pricing.agent_price_reports
  ADD CONSTRAINT agent_price_reports_status_check
  CHECK (status IN (
    'pending',
    'pending_review',
    'verified',
    'incorporated',
    'rejected',
    'request_info',
    'expired',
    'pending_second_approval'
  ));

ALTER TABLE market_pricing.agent_price_reports
  ADD COLUMN IF NOT EXISTS env TEXT NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS segment_id TEXT,
  ADD COLUMN IF NOT EXISTS segment_label TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS recommendation_price_low NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS recommendation_price_high NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS recommendation_price_point NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS reason_code TEXT,
  ADD COLUMN IF NOT EXISTS incorporated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incorporated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_request_id UUID,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resubmit_of TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fk_agent_price_reports_approval_request'
       AND conrelid = 'market_pricing.agent_price_reports'::regclass
  ) THEN
    ALTER TABLE market_pricing.agent_price_reports
      ADD CONSTRAINT fk_agent_price_reports_approval_request
      FOREIGN KEY (approval_request_id) REFERENCES fin.approval_requests(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fk_agent_price_reports_resubmit_of'
       AND conrelid = 'market_pricing.agent_price_reports'::regclass
  ) THEN
    ALTER TABLE market_pricing.agent_price_reports
      ADD CONSTRAINT fk_agent_price_reports_resubmit_of
      FOREIGN KEY (resubmit_of) REFERENCES market_pricing.agent_price_reports(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_agent_price_reports_env'
       AND conrelid = 'market_pricing.agent_price_reports'::regclass
  ) THEN
    ALTER TABLE market_pricing.agent_price_reports
      ADD CONSTRAINT chk_agent_price_reports_env
      CHECK (env IN ('live', 'test'));
  END IF;
END
$$;

-- Backfill recommendation point from legacy sold_price when missing.
UPDATE market_pricing.agent_price_reports
   SET recommendation_price_point = sold_price
 WHERE recommendation_price_point IS NULL
   AND sold_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_price_reports_env_status
  ON market_pricing.agent_price_reports (env, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_price_reports_segment
  ON market_pricing.agent_price_reports (segment_id)
  WHERE segment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_price_reports_country
  ON market_pricing.agent_price_reports (country_code)
  WHERE country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_price_reports_approval_request
  ON market_pricing.agent_price_reports (approval_request_id)
  WHERE approval_request_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Pricing benchmarks (authoritative incorporate writes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_pricing.pricing_benchmarks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  segment_id TEXT NOT NULL,
  country_code TEXT,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  price_point NUMERIC(15,2) NOT NULL,
  price_low NUMERIC(15,2),
  price_high NUMERIC(15,2),
  source_report_id TEXT REFERENCES market_pricing.agent_price_reports(id),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  env TEXT NOT NULL DEFAULT 'live' CHECK (env IN ('live', 'test')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (segment_id, env)
);

CREATE INDEX IF NOT EXISTS idx_pricing_benchmarks_country
  ON market_pricing.pricing_benchmarks (country_code)
  WHERE country_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS market_pricing.pricing_benchmark_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  segment_id TEXT NOT NULL,
  env TEXT NOT NULL DEFAULT 'live' CHECK (env IN ('live', 'test')),
  snapshot_date DATE NOT NULL,
  price NUMERIC(15,2) NOT NULL,
  confidence_low NUMERIC(15,2),
  confidence_high NUMERIC(15,2),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  source_report_id TEXT REFERENCES market_pricing.agent_price_reports(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (segment_id, env, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_pricing_benchmark_snapshots_series
  ON market_pricing.pricing_benchmark_snapshots (segment_id, env, snapshot_date DESC);

-- ---------------------------------------------------------------------------
-- Two-person action kind for high-delta incorporate
-- ---------------------------------------------------------------------------
ALTER TABLE fin.approval_requests
  DROP CONSTRAINT IF EXISTS chk_approval_requests_action_kind;

ALTER TABLE fin.approval_requests
  ADD CONSTRAINT chk_approval_requests_action_kind
  CHECK (action_kind IN (
    'LARGE_GRANT', 'LARGE_REFUND', 'NEGATIVE_ADJUSTMENT', 'FACILITY_OPS',
    'BACKDATED_AMENDMENT', 'INVOICE_VOID', 'WRITE_OFF', 'RECONCILIATION_OVERRIDE',
    'MASS_OPERATION', 'PLATFORM_ADMIN_RECOVERY', 'AUDIT_RETENTION',
    'VENDOR_VARIANCE_OVERRIDE', 'VENDOR_RATE_CHANGE',
    'PRICE_REPORT_INCORPORATE'
  ));

-- Wave 5 / PR #127 — pricing evidence uploads + reporter_confidence.
-- Prefer 363 to avoid colliding with PR-A #178's 362_fin_approval*.
-- Idempotent. Do not renumber.

-- ---------------------------------------------------------------------------
-- Private evidence blobs for price / comparable report submitters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_pricing.pricing_evidence_files (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retention_expires_at TIMESTAMPTZ NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'pending_scan',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_pricing_evidence_files_scan_status'
       AND conrelid = 'market_pricing.pricing_evidence_files'::regclass
  ) THEN
    ALTER TABLE market_pricing.pricing_evidence_files
      ADD CONSTRAINT chk_pricing_evidence_files_scan_status
      CHECK (scan_status IN ('pending_scan', 'clean', 'quarantined', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_pricing_evidence_files_content_type'
       AND conrelid = 'market_pricing.pricing_evidence_files'::regclass
  ) THEN
    ALTER TABLE market_pricing.pricing_evidence_files
      ADD CONSTRAINT chk_pricing_evidence_files_content_type
      CHECK (content_type IN (
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
      ));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_evidence_files_storage_key
  ON market_pricing.pricing_evidence_files (storage_key);

CREATE INDEX IF NOT EXISTS idx_pricing_evidence_files_agent_uploaded
  ON market_pricing.pricing_evidence_files (agent_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_evidence_files_retention
  ON market_pricing.pricing_evidence_files (retention_expires_at);

COMMENT ON TABLE market_pricing.pricing_evidence_files IS
  'WF-05/06 supporting evidence metadata. Bytes are private; PA views via 60-min signed URL.';

COMMENT ON COLUMN market_pricing.pricing_evidence_files.storage_key IS
  'Opaque private-store key. NEVER expose unsigned.';

-- ---------------------------------------------------------------------------
-- Discrete reporter confidence + supporting document id arrays
-- ---------------------------------------------------------------------------
ALTER TABLE market_pricing.agent_price_reports
  ADD COLUMN IF NOT EXISTS reporter_confidence TEXT,
  ADD COLUMN IF NOT EXISTS supporting_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE market_pricing.comparable_reports
  ADD COLUMN IF NOT EXISTS reporter_confidence TEXT,
  ADD COLUMN IF NOT EXISTS supporting_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_agent_price_reports_reporter_confidence'
       AND conrelid = 'market_pricing.agent_price_reports'::regclass
  ) THEN
    ALTER TABLE market_pricing.agent_price_reports
      ADD CONSTRAINT chk_agent_price_reports_reporter_confidence
      CHECK (
        reporter_confidence IS NULL
        OR reporter_confidence IN ('self_witnessed', 'hearsay', 'hard_evidence')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_comparable_reports_reporter_confidence'
       AND conrelid = 'market_pricing.comparable_reports'::regclass
  ) THEN
    ALTER TABLE market_pricing.comparable_reports
      ADD CONSTRAINT chk_comparable_reports_reporter_confidence
      CHECK (
        reporter_confidence IS NULL
        OR reporter_confidence IN ('self_witnessed', 'hearsay', 'hard_evidence')
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_comparable_reports_open_dup
  ON market_pricing.comparable_reports (reporter_id, comparable_id, status)
  WHERE status IN ('pending', 'in_review', 'pending_review', 'awaiting_info');

CREATE INDEX IF NOT EXISTS idx_agent_price_reports_reporter_day
  ON market_pricing.agent_price_reports (reporter_id, created_at DESC);

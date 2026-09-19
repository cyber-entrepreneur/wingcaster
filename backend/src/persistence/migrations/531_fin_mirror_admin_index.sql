-- PA-CRD-009 — fin mirror admin indexes. credit_worker_status table comes from migration 530 (#329).

DO $$
BEGIN
  IF to_regclass('public.credit_worker_status') IS NOT NULL THEN
    ALTER TABLE public.credit_worker_status
      ADD COLUMN IF NOT EXISTS last_skipped_rows INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ledger_tx_credit_mirror_source
  ON fin.ledger_transactions (economic_source_type, economic_source_id)
  WHERE shape IN ('GRANT_MIRROR', 'CONSUME_MIRROR');

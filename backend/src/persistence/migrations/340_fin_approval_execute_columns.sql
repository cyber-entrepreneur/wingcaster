-- BE-BLOCKER-34 execute columns
ALTER TABLE fin.approval_requests
  ADD COLUMN IF NOT EXISTS workflow_code TEXT,
  ADD COLUMN IF NOT EXISTS value_tier TEXT,
  ADD COLUMN IF NOT EXISTS execute_attempt INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmation_phrase TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_phrase_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_by_actor_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_approval_requests_value_tier'
      AND conrelid = 'fin.approval_requests'::regclass
  ) THEN
    ALTER TABLE fin.approval_requests ADD CONSTRAINT chk_approval_requests_value_tier
      CHECK (value_tier IS NULL OR value_tier IN ('standard', 'elevated', 'high_value'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_approval_requests_workflow_status
  ON fin.approval_requests (environment, workflow_code, status) WHERE workflow_code IS NOT NULL;

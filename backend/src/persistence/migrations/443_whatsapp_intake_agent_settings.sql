-- AGT-WLA-004 — WhatsApp intake settings (per-agent preferences).

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS whatsapp_intake_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS whatsapp_intake_notification_cadence TEXT NOT NULL DEFAULT 'immediately';

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS whatsapp_intake_auto_approve_high_confidence BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agents_whatsapp_intake_notification_cadence_check'
  ) THEN
    ALTER TABLE agents
      ADD CONSTRAINT agents_whatsapp_intake_notification_cadence_check
      CHECK (whatsapp_intake_notification_cadence IN ('immediately', 'hourly', 'daily'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agents_whatsapp_intake_enabled
  ON agents (whatsapp_intake_enabled)
  WHERE whatsapp_intake_enabled = TRUE;

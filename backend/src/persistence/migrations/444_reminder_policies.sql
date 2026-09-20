-- AGT-TSK-003 — Reminder policies (appointment reminder templates).

CREATE TABLE IF NOT EXISTS reminder_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  appointment_type TEXT NOT NULL,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT reminder_policies_owner_type_check CHECK (owner_type IN ('agent', 'agency')),
  CONSTRAINT reminder_policies_appointment_type_check CHECK (
    appointment_type IN ('viewing', 'call', 'booking', 'meeting')
  )
);

CREATE INDEX IF NOT EXISTS idx_reminder_policies_owner
  ON reminder_policies (owner_type, owner_id);

CREATE INDEX IF NOT EXISTS idx_reminder_policies_appointment_type
  ON reminder_policies (appointment_type);

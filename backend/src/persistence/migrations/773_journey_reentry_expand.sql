-- Wave 2E — expand journeys with re-entry + exit criteria (non-destructive).

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS reentry_rules JSONB NOT NULL DEFAULT '{"allow":false,"cooldown_hours":0,"max_entries":1}'::jsonb;

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS exit_criteria JSONB NOT NULL DEFAULT '{}'::jsonb;

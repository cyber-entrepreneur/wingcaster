-- BE-BLOCKER-35 — portal_registry_versions for PA-POR-002 shape snapshots.
-- portal_registry columns + pending_activations + activation_history already
-- landed in 323_portal_registry.sql — do NOT recreate them here.
-- Migration numbers 355–359 reserved for BE-BLOCKER-35.

ALTER TABLE public.portal_registry
  ADD COLUMN IF NOT EXISTS current_version INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.portal_registry_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  portal_code TEXT NOT NULL REFERENCES public.portal_registry(code) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (portal_code, version)
);

CREATE INDEX IF NOT EXISTS idx_portal_registry_versions_portal
  ON public.portal_registry_versions (portal_code, version DESC);

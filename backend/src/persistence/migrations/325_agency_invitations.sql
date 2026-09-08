-- BE-BLOCKER-07 — agency_invitations for AGN-MEM-003/005 invite links.
-- Opaque shareable codes; GET resolve + POST accept create agency_applications.
-- Numbering: 324 reserved (parallel agent); do not renumber.
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.agency_invitations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_by TEXT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  single_use BOOLEAN NOT NULL DEFAULT true,
  used_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agency_invitations_code
  ON public.agency_invitations (code);

CREATE INDEX IF NOT EXISTS idx_agency_invitations_agency_id
  ON public.agency_invitations (agency_id);

COMMENT ON TABLE public.agency_invitations IS
  'Shareable agency invite codes (AGN-MEM-003 create / AGN-MEM-005 accept).';

COMMENT ON COLUMN public.agency_invitations.code IS
  'Opaque URL-safe token; unique across all invitations.';

COMMENT ON COLUMN public.agency_invitations.created_by IS
  'Agency owner/admin who created the invite; aka created_by_user_id.';

-- Agency first-run onboarding progress (branding / invites / billing / portal /
-- listing / roles / 2FA). Distinct from agent_onboarding_state (321): the same
-- user can own an agency AND be an agent under another with unrelated checklists.
--
-- Numbering: 321 is agent_onboarding_state (BE-BLOCKER-20); 322 is Wave 0.5
-- BE-BLOCKER-30. Parallel agents own these tables separately.

CREATE TABLE IF NOT EXISTS public.agency_onboarding_state (
  agency_id TEXT PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  step TEXT NOT NULL DEFAULT 'welcome',
  path TEXT,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  dismissed_forever BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.agency_onboarding_state IS
  'Per-agency onboarding progress. Distinct from agent_onboarding_state (user-scoped).';

COMMENT ON COLUMN public.agency_onboarding_state.checklist IS
  'JSON object; known keys: branding, invites, billing, portal, listing, roles, 2FA.';

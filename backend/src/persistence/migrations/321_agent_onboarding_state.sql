-- Agent product-tour onboarding progress (welcome / path / checklist).
-- Distinct from agents.onboarding_stage (account activation).
--
-- Numbering: 315 is whatsapp_activation_codes; 321 reserved for Wave 0.5
-- BE-BLOCKER-20 so parallel agents can land 316–320 without collision.

CREATE TABLE IF NOT EXISTS public.agent_onboarding_state (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  step TEXT NOT NULL DEFAULT 'welcome',
  path TEXT,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  dismissed_forever BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

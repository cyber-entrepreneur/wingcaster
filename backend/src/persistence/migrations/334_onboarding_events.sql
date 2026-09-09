-- BE-BLOCKER-15 — onboarding_events + agent_activation_state for AGT-ACT / AGT-ONB / WLB.
-- Distinct from agent_onboarding_state (321, product-tour checklist) and
-- agency_onboarding_state (322). Activation wizard uses activation_state.steps[].
--
-- Numbering: 330–333 reserved for in-flight account-recovery drafts; do not reuse.
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id TEXT,
  family TEXT NOT NULL,
  event_type TEXT NOT NULL,
  step_id TEXT,
  completed_via TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT onboarding_events_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_user_created
  ON public.onboarding_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_user_step
  ON public.onboarding_events (user_id, step_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_family_created
  ON public.onboarding_events (family, created_at DESC);

COMMENT ON TABLE public.onboarding_events IS
  'Append-only onboarding / activation / WLB tour events (BE-BLOCKER-15).';

COMMENT ON COLUMN public.onboarding_events.family IS
  'Event family: activation | onboarding | wlb | …';

COMMENT ON COLUMN public.onboarding_events.event_type IS
  'step_complete | step_defer | auto_complete | free-form tour event names';

COMMENT ON COLUMN public.onboarding_events.completed_via IS
  'onboarding | whatsapp_intake | dashboard_action | direct | null';

-- Derived / explicit activation wizard progress (AGT-ACT-001 activation_state.steps[]).
CREATE TABLE IF NOT EXISTS public.agent_activation_state (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id TEXT,
  signup_path TEXT NOT NULL DEFAULT 'solo'
    CHECK (signup_path IN ('solo', 'join', 'agency')),
  country_code TEXT,
  steps JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_activation_state_steps_object
    CHECK (jsonb_typeof(steps) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_agent_activation_state_tenant
  ON public.agent_activation_state (tenant_id)
  WHERE tenant_id IS NOT NULL;

COMMENT ON TABLE public.agent_activation_state IS
  'Per-user activation wizard progress (BE-BLOCKER-15 / AGT-ACT-001).';

COMMENT ON COLUMN public.agent_activation_state.steps IS
  'Map of step_id → { state, completed_at, completed_via }.';

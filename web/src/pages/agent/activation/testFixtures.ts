import type { ActivationState, ActivationStep, ActivationStepState, CompletedVia, SignupPath } from './types'

export function makeStep(overrides: Partial<ActivationStep> & Pick<ActivationStep, 'id' | 'order'>): ActivationStep {
  return {
    state: 'not_started',
    completed_at: null,
    completed_via: null,
    sub_route: `/activate/${overrides.id.replace('_', '-')}`,
    ...overrides,
  }
}

export function makeActivationState(overrides: Partial<ActivationState> = {}): ActivationState {
  const steps =
    overrides.steps ??
    ([
      makeStep({ id: 'whatsapp', order: 1, sub_route: '/activate/whatsapp' }),
      makeStep({ id: 'first_listing', order: 2, sub_route: '/activate/first-listing' }),
      makeStep({ id: 'portal_credentials', order: 3, sub_route: '/activate/portal-credentials' }),
      makeStep({ id: 'working_hours', order: 4, sub_route: '/activate/working-hours' }),
      makeStep({ id: 'invite_team', order: 5, sub_route: '/activate/invite-team', state: 'locked' }),
    ] as ActivationStep[])
  return {
    user_id: 'usr_test',
    tenant_id: 'personal:usr_test',
    signup_path: 'solo',
    country_code: 'AE',
    completed_count: steps.filter((s) => s.state === 'complete').length,
    total_count: steps.length,
    ...overrides,
    steps,
  }
}

export function withState(
  id: string,
  state: ActivationStepState,
  extra: Partial<ActivationStep> = {},
  via: CompletedVia | null = null,
): ActivationStep {
  const order =
    { whatsapp: 1, first_listing: 2, portal_credentials: 3, working_hours: 4, invite_team: 5 }[id] ?? 1
  return makeStep({
    id,
    order,
    state,
    completed_at: state === 'complete' ? '2026-09-01T14:22:00Z' : null,
    completed_via: state === 'complete' ? via : null,
    ...extra,
  })
}

export function midFlowSolo(): ActivationState {
  return makeActivationState({
    signup_path: 'solo',
    steps: [
      withState('whatsapp', 'complete', { sub_route: '/activate/whatsapp' }, 'onboarding'),
      withState('first_listing', 'complete', { sub_route: '/activate/first-listing' }, 'whatsapp_intake'),
      withState('portal_credentials', 'in_progress', { sub_route: '/activate/portal-credentials' }),
      withState('working_hours', 'not_started', { sub_route: '/activate/working-hours' }),
      withState('invite_team', 'locked', {
        sub_route: '/activate/invite-team',
        lock_reason: 'solo_signup_path',
      }),
    ],
  })
}

export function agencyOwnerState(path: SignupPath = 'agency'): ActivationState {
  return makeActivationState({
    signup_path: path,
    steps: [
      withState('whatsapp', 'not_started', { sub_route: '/activate/whatsapp' }),
      withState('first_listing', 'not_started', { sub_route: '/activate/first-listing' }),
      withState('portal_credentials', 'not_started', { sub_route: '/activate/portal-credentials' }),
      withState('working_hours', 'not_started', { sub_route: '/activate/working-hours' }),
      withState('invite_team', 'not_started', { sub_route: '/activate/invite-team' }),
    ],
  })
}

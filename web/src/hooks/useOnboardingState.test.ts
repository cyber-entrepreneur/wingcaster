// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  EMPTY_CHECKLIST,
  createDefaultOnboardingState,
  resolveCompletedVia,
  resolveIsStepComplete,
  useOnboardingState,
  type ActivationState,
  type OnboardingState,
} from './useOnboardingState'

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
}))

const fetchMock = vi.fn()

function jsonRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === '' || body == null ? '' : JSON.stringify(body)),
  }
}

function welcomeOnboarding(overrides?: Partial<OnboardingState>): OnboardingState {
  return createDefaultOnboardingState({
    user_id: 'usr_sara',
    started_at: '2026-09-08T10:00:00.000Z',
    updated_at: '2026-09-08T10:00:00.000Z',
    ...overrides,
  })
}

function activationDoc(
  overrides?: {
    stepOverrides?: Record<string, Partial<ActivationState['steps'][number]>>
  } & Partial<Omit<ActivationState, 'steps'>>,
): ActivationState {
  const { stepOverrides, ...rest } = overrides ?? {}
  const steps = [
    {
      id: 'whatsapp',
      order: 1,
      state: 'not_started' as const,
      completed_at: null,
      completed_via: null,
      sub_route: '/activate/whatsapp',
      ...stepOverrides?.whatsapp,
    },
    {
      id: 'first_listing',
      order: 2,
      state: 'not_started' as const,
      completed_at: null,
      completed_via: null,
      sub_route: '/activate/first-listing',
      ...stepOverrides?.first_listing,
    },
    {
      id: 'portal_credentials',
      order: 3,
      state: 'not_started' as const,
      completed_at: null,
      completed_via: null,
      sub_route: '/activate/portal-credentials',
      ...stepOverrides?.portal_credentials,
    },
    {
      id: 'working_hours',
      order: 4,
      state: 'not_started' as const,
      completed_at: null,
      completed_via: null,
      sub_route: '/activate/working-hours',
      ...stepOverrides?.working_hours,
    },
    {
      id: 'invite_team',
      order: 5,
      state: 'locked' as const,
      completed_at: null,
      completed_via: null,
      sub_route: '/activate/invite-team',
      lock_reason: 'solo_signup_path',
      ...stepOverrides?.invite_team,
    },
  ]
  return {
    user_id: 'usr_sara',
    tenant_id: 'personal:usr_sara',
    signup_path: 'solo',
    country_code: 'AE',
    completed_count: steps.filter((s) => s.state === 'complete').length,
    total_count: 5,
    ...rest,
    steps,
  }
}

type Harness = {
  onboardingGet: { status: number; body: unknown }
  activationGet: { status: number; body: unknown }
  onboardingPatch: { status: number; body: unknown } | null
  activationComplete: { status: number; body: unknown } | null
  activationDefer: { status: number; body: unknown } | null
}

function installFetch(h: Harness) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const path = String(url)
    const method = (init?.method || 'GET').toUpperCase()

    if (path.endsWith('/user/onboarding-state') && method === 'GET') {
      return jsonRes(h.onboardingGet.status, h.onboardingGet.body)
    }
    if (path.endsWith('/user/onboarding-state') && method === 'PATCH') {
      const cfg = h.onboardingPatch ?? { status: 200, body: h.onboardingGet.body }
      return jsonRes(cfg.status, cfg.body)
    }
    if (path.endsWith('/agent/activation_state/complete') && method === 'POST') {
      const cfg = h.activationComplete ?? { status: 200, body: h.activationGet.body }
      return jsonRes(cfg.status, cfg.body)
    }
    if (path.endsWith('/agent/activation_state/defer') && method === 'POST') {
      const cfg = h.activationDefer ?? { status: 200, body: h.activationGet.body }
      return jsonRes(cfg.status, cfg.body)
    }
    if (path.endsWith('/agent/activation_state') && method === 'GET') {
      return jsonRes(h.activationGet.status, h.activationGet.body)
    }
    return jsonRes(404, { error: 'not found' })
  })
}

async function loadedHook() {
  const hook = renderHook(() => useOnboardingState())
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  return hook
}

describe('resolveIsStepComplete / resolveCompletedVia', () => {
  it('activation whatsapp complete wins even when onboarding checklist has not caught up', () => {
    const onboarding = welcomeOnboarding()
    const activation = activationDoc({
      stepOverrides: {
        whatsapp: {
          state: 'complete',
          completed_via: 'whatsapp_intake',
          completed_at: '2026-09-08T12:00:00.000Z',
        },
      },
    })
    expect(resolveIsStepComplete('whatsapp', onboarding, activation)).toBe(true)
    expect(resolveCompletedVia('whatsapp', onboarding, activation)).toBe('whatsapp_intake')
    expect(onboarding.checklist.channels_connected).toBe(false)
  })
})

describe('useOnboardingState', () => {
  let harness: Harness

  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
    vi.stubGlobal('fetch', fetchMock)
    harness = {
      onboardingGet: { status: 200, body: welcomeOnboarding() },
      activationGet: { status: 200, body: activationDoc() },
      onboardingPatch: null,
      activationComplete: null,
      activationDefer: null,
    }
    installFetch(harness)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('404/empty → welcome', async () => {
    harness.onboardingGet = { status: 404, body: { error: 'Not found' } }
    const a = await loadedHook()
    expect(a.result.current.isError).toBe(false)
    expect(a.result.current.error).toBeUndefined()
    expect(a.result.current.state.step).toBe('welcome')
    expect(a.result.current.state.path).toBeNull()
    expect(a.result.current.state.dismissed_forever).toBe(false)
    expect(a.result.current.state.checklist).toEqual(EMPTY_CHECKLIST)
    expect(a.result.current.data.step).toBe('welcome')
    a.unmount()

    harness.onboardingGet = { status: 200, body: {} }
    const b = await loadedHook()
    expect(b.result.current.isError).toBe(false)
    expect(b.result.current.state.step).toBe('welcome')
    expect(b.result.current.state.path).toBeNull()
    expect(b.result.current.state.checklist).toEqual(EMPTY_CHECKLIST)
    expect(b.result.current.state.dismissed_forever).toBe(false)
    b.unmount()
  })

  it('patch merges checklist_delta', async () => {
    const { result } = await loadedHook()
    expect(result.current.state.checklist.welcome_seen).toBe(false)

    const patched = welcomeOnboarding({
      checklist: { ...EMPTY_CHECKLIST, welcome_seen: true },
    })
    harness.onboardingPatch = { status: 200, body: patched }
    harness.onboardingGet = { status: 200, body: patched }

    let returned: OnboardingState | undefined
    await act(async () => {
      returned = await result.current.patch({ checklist_delta: { welcome_seen: true } })
    })

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/user/onboarding-state') && (init as RequestInit | undefined)?.method === 'PATCH',
    )
    expect(patchCall).toBeTruthy()
    expect(patchCall?.[1]).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ checklist_delta: { welcome_seen: true } }),
      }),
    )
    expect(result.current.state.checklist.welcome_seen).toBe(true)
    expect(returned?.checklist.welcome_seen).toBe(true)
    expect(result.current.state.checklist.first_listing_published).toBe(false)
  })

  it('409 → no throw / treat onboarded', async () => {
    const { result } = await loadedHook()
    harness.onboardingPatch = {
      status: 409,
      body: { error: 'INVALID_TRANSITION', current_step: 'complete' },
    }
    harness.onboardingGet = {
      status: 200,
      body: welcomeOnboarding({
        step: 'complete',
        completed_at: '2026-09-08T15:00:00.000Z',
        checklist: { ...EMPTY_CHECKLIST, welcome_seen: true, first_listing_published: true },
      }),
    }

    let returned: OnboardingState | undefined
    await act(async () => {
      returned = await result.current.patch({ step: 'welcome', path: null })
    })

    expect(returned?.step).toBe('complete')
    expect(result.current.state.step).toBe('complete')
    expect(result.current.isError).toBe(false)
  })

  it('activation whatsapp complete ⇒ isStepComplete(whatsapp) and completedVia even if onboarding checklist has not caught up', async () => {
    harness.onboardingGet = {
      status: 200,
      body: welcomeOnboarding({
        step: 'welcome',
        path: null,
        checklist: { ...EMPTY_CHECKLIST },
      }),
    }
    harness.activationGet = {
      status: 200,
      body: activationDoc({
        stepOverrides: {
          whatsapp: {
            state: 'complete',
            completed_via: 'whatsapp_intake',
            completed_at: '2026-09-08T12:00:00.000Z',
          },
        },
      }),
    }

    const { result } = await loadedHook()
    expect(result.current.state.checklist.channels_connected).toBe(false)
    expect(result.current.state.checklist.first_listing_published).toBe(false)
    expect(result.current.isStepComplete('whatsapp')).toBe(true)
    expect(result.current.completedVia('whatsapp')).toBe('whatsapp_intake')
    expect(result.current.isStepComplete('first_listing')).toBe(false)
    expect(result.current.completedVia('first_listing')).toBeNull()
  })

  it('activation first_listing complete auto-completes the onboarding checklist flag', async () => {
    harness.activationGet = {
      status: 200,
      body: activationDoc({
        stepOverrides: {
          first_listing: {
            state: 'complete',
            completed_via: 'onboarding',
            completed_at: '2026-09-08T13:00:00.000Z',
          },
        },
      }),
    }
    const { result } = await loadedHook()
    expect(result.current.isStepComplete('first_listing')).toBe(true)
    expect(result.current.completedVia('first_listing')).toBe('onboarding')
    expect(result.current.state.checklist.first_listing_published).toBe(true)
    expect(result.current.state.checklist.first_listing_drafted).toBe(true)
  })

  it('activation fetch 500 ⇒ onboarding still works', async () => {
    harness.onboardingGet = {
      status: 200,
      body: welcomeOnboarding({ step: 'welcome_skipped', path: null }),
    }
    harness.activationGet = { status: 500, body: { error: 'Internal server error' } }

    const { result } = await loadedHook()
    expect(result.current.isError).toBe(false)
    expect(result.current.state.step).toBe('welcome_skipped')
    expect(result.current.activation).toBeNull()
    expect(result.current.isStepComplete('whatsapp')).toBe(false)
    expect(result.current.data.step).toBe('welcome_skipped')
  })

  it('completeActivation posts { step_id, completed_via } and updates local activation', async () => {
    const { result } = await loadedHook()
    expect(result.current.isStepComplete('whatsapp')).toBe(false)

    const completed = activationDoc({
      stepOverrides: {
        whatsapp: {
          state: 'complete',
          completed_via: 'whatsapp_intake',
          completed_at: '2026-09-09T10:00:00.000Z',
        },
      },
    })
    harness.activationComplete = { status: 200, body: completed }
    harness.activationGet = { status: 200, body: completed }

    let returned: ActivationState | undefined
    await act(async () => {
      returned = await result.current.completeActivation('whatsapp', 'whatsapp_intake')
    })

    const postCall = fetchMock.mock.calls.find(([url, init]) => {
      return (
        String(url).endsWith('/agent/activation_state/complete') && (init as RequestInit | undefined)?.method === 'POST'
      )
    })
    expect(postCall).toBeTruthy()
    expect(postCall?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ step_id: 'whatsapp', completed_via: 'whatsapp_intake' }),
      }),
    )
    expect(returned?.steps.find((s) => s.id === 'whatsapp')?.state).toBe('complete')
    expect(result.current.activation?.steps.find((s) => s.id === 'whatsapp')?.state).toBe('complete')
    expect(result.current.activation?.steps.find((s) => s.id === 'whatsapp')?.completed_via).toBe('whatsapp_intake')
    expect(result.current.isStepComplete('whatsapp')).toBe(true)
    expect(result.current.completedVia('whatsapp')).toBe('whatsapp_intake')
  })

  it('sends fi_token on onboarding and activation reads', async () => {
    localStorage.setItem('fi_token', 'tok_agent')
    await loadedHook()
    const onboardingCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/user/onboarding-state'))
    const activationCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/agent/activation_state'))
    expect(onboardingCall?.[0]).toBe('/api/user/onboarding-state')
    expect(activationCall?.[0]).toBe('/api/agent/activation_state')
    expect((onboardingCall?.[1] as RequestInit).headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer tok_agent' }),
    )
    expect((activationCall?.[1] as RequestInit).headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer tok_agent' }),
    )
  })
})

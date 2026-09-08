import { useCallback, useState } from 'react'

/** Onboarding tour step machine (GET/PATCH `/api/user/onboarding-state`). */
export type OnboardingStep =
  | 'welcome'
  | 'welcome_skipped'
  | 'whatsapp_intake_pending'
  | 'manual_wizard'
  | 'import_pending'
  | 'draft_review'
  | 'first_published'
  | 'complete'

export type OnboardingPath = 'whatsapp' | 'manual' | 'import' | null

/** Checklist flags from `agent_onboarding_state.checklist` JSONB. */
export interface OnboardingChecklistFlags {
  welcome_seen: boolean
  first_listing_drafted: boolean
  first_listing_published: boolean
  channels_connected: boolean
  notifications_enabled: boolean
  profile_completed: boolean
  subscription_active: boolean
}

/** Full onboarding progress document returned by GET/PATCH. */
export interface OnboardingState {
  user_id: string
  step: OnboardingStep
  path: OnboardingPath
  started_at: string
  updated_at: string
  completed_at: string | null
  checklist: OnboardingChecklistFlags
  /** Soft-dismiss from AGT-ONB-005; reversible in settings. */
  dismissed_forever?: boolean
}

/** Partial write body for PATCH `/api/user/onboarding-state`. */
export interface OnboardingStatePatch {
  step?: OnboardingStep
  path?: OnboardingPath
  checklist_delta?: Partial<OnboardingChecklistFlags>
  dismissed_forever?: boolean
}

/**
 * SWR-shaped return surface (no `swr` dependency required at extract stage).
 * Downstream waves may swap the stub for real `useSWR('/api/user/onboarding-state')`.
 */
export interface UseOnboardingStateResult {
  /** Current progress document (mock until API lands). */
  state: OnboardingState
  /** Optimistic local merge — stub only; no network. */
  patch: (body: OnboardingStatePatch) => Promise<OnboardingState>
  /** True while initial load would be in flight. Stub always false after mount. */
  isLoading: boolean
  /** True on fetch failure. Stub never errors (404 → welcome). */
  isError: boolean
  /** Revalidate stand-in. */
  mutate: () => Promise<OnboardingState>
  /** Alias for SWR `data` consumers. */
  data: OnboardingState
  error: Error | undefined
}

const STUB_STATE: OnboardingState = {
  user_id: 'usr_stub_onboarding',
  step: 'welcome',
  path: null,
  started_at: '2026-09-08T10:00:00.000Z',
  updated_at: '2026-09-08T10:00:00.000Z',
  completed_at: null,
  dismissed_forever: false,
  checklist: {
    welcome_seen: true,
    first_listing_drafted: false,
    first_listing_published: false,
    channels_connected: false,
    notifications_enabled: false,
    profile_completed: false,
    subscription_active: false,
  },
}

/**
 * SWR-shaped onboarding progress hook (local stub — no real fetch).
 *
 * Used by: AGT-ONB-001/002/003/004/005 + AGT-DSH-001 (checklist mount gate).
 * Contract: resilient to 404 → `step: 'welcome'`. Real GET/PATCH lands with `[BE-NEW-06]`.
 */
export function useOnboardingState(
  initial?: Partial<OnboardingState>,
): UseOnboardingStateResult {
  const [state, setState] = useState<OnboardingState>(() => ({
    ...STUB_STATE,
    ...initial,
    checklist: {
      ...STUB_STATE.checklist,
      ...initial?.checklist,
    },
  }))

  const mutate = useCallback(async () => state, [state])

  const patch = useCallback(async (body: OnboardingStatePatch) => {
    let next: OnboardingState = state
    setState((prev) => {
      next = {
        ...prev,
        step: body.step ?? prev.step,
        path: body.path !== undefined ? body.path : prev.path,
        dismissed_forever: body.dismissed_forever ?? prev.dismissed_forever,
        checklist: {
          ...prev.checklist,
          ...body.checklist_delta,
        },
        updated_at: new Date().toISOString(),
        completed_at:
          body.step === 'complete' ? new Date().toISOString() : prev.completed_at,
      }
      return next
    })
    return next
  }, [state])

  return {
    state,
    data: state,
    patch,
    isLoading: false,
    isError: false,
    error: undefined,
    mutate,
  }
}

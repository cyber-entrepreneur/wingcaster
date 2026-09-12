import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  completeActivationStep,
  deferActivationStep,
  fetchActivationState,
  fetchPortalRegistry,
} from './api'
import { useOnboardingState, type UseOnboardingStateResult } from './onboardingHook'
import type {
  ActivationState,
  ActivationStep,
  ActivationStepId,
  CompletedVia,
  LockReason,
  PortalRegistryEntry,
} from './types'

type HookWithActivation = UseOnboardingStateResult & {
  complete?: (
    stepId: string,
    completedVia?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<ActivationState>
  defer?: (stepId: string) => Promise<ActivationState>
  activation?: ActivationState
}

function checklistDeltaFor(stepId: string): Record<string, boolean> | null {
  if (stepId === 'whatsapp') return { channels_connected: true }
  if (stepId === 'first_listing') {
    return { first_listing_published: true, first_listing_drafted: true }
  }
  return null
}

function enrichSteps(
  state: ActivationState,
  portalRegistryEmpty: boolean,
): ActivationStep[] {
  return state.steps.map((step) => {
    if (step.id === 'portal_credentials') {
      if (step.state === 'complete') return step
      if (portalRegistryEmpty || step.state === 'locked') {
        return {
          ...step,
          state: 'locked',
          lock_reason: (step.lock_reason || 'portal_registry_empty_for_country') as LockReason,
        }
      }
    }
    if (step.id === 'invite_team' && step.state === 'locked') {
      const reason: LockReason =
        state.signup_path === 'join' ? 'join_signup_path' : 'solo_signup_path'
      return { ...step, lock_reason: step.lock_reason || reason }
    }
    return step
  })
}

export function useActivationState() {
  const onboarding = useOnboardingState() as HookWithActivation
  const [state, setState] = useState<ActivationState | null>(onboarding.activation ?? null)
  const [isLoading, setIsLoading] = useState(!onboarding.activation)
  const [isError, setIsError] = useState(false)
  const [portals, setPortals] = useState<PortalRegistryEntry[]>([])
  const [portalsResolved, setPortalsResolved] = useState(false)

  const apply = useCallback(
    (next: ActivationState, registry?: PortalRegistryEntry[]) => {
      const list = registry ?? portals
      const empty = portalsResolved || registry !== undefined ? list.length === 0 : false
      setState({
        ...next,
        steps: enrichSteps(next, empty),
      })
    },
    [portals, portalsResolved],
  )

  const refresh = useCallback(async () => {
    setIsError(false)
    setIsLoading(true)
    try {
      const next = await fetchActivationState()
      const registry = await fetchPortalRegistry(next.country_code)
      setPortals(registry)
      setPortalsResolved(true)
      apply(next, registry)
      await onboarding.mutate()
      return next
    } catch {
      setIsError(true)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [apply, onboarding])

  useEffect(() => {
    void refresh()
    // Mount-only: refresh reads latest closures via refresh identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const complete = useCallback(
    async (
      stepId: ActivationStepId | string,
      completedVia: CompletedVia | string = 'dashboard_action',
      metadata?: Record<string, unknown>,
    ) => {
      let next: ActivationState
      if (typeof onboarding.complete === 'function') {
        next = await onboarding.complete(stepId, completedVia, metadata)
      } else {
        next = await completeActivationStep(stepId, completedVia, metadata)
        const delta = checklistDeltaFor(stepId)
        if (delta) {
          await onboarding.patch({ checklist_delta: delta })
        }
        await onboarding.mutate()
      }
      apply(next)
      return next
    },
    [apply, onboarding],
  )

  const defer = useCallback(
    async (stepId: ActivationStepId | string) => {
      let next: ActivationState
      if (typeof onboarding.defer === 'function') {
        next = await onboarding.defer(stepId)
      } else {
        next = await deferActivationStep(stepId)
        await onboarding.mutate()
      }
      apply(next)
      return next
    },
    [apply, onboarding],
  )

  const portalRegistryEmpty = portalsResolved && portals.length === 0

  const completedCount = useMemo(
    () => (state ? state.steps.filter((s) => s.state === 'complete').length : 0),
    [state],
  )
  const totalCount = useMemo(
    () => (state ? state.steps.length || state.total_count : 0),
    [state],
  )

  return {
    state,
    isLoading,
    isError,
    refresh,
    complete,
    defer,
    portals,
    portalRegistryEmpty,
    completedCount,
    totalCount,
    onboarding,
  }
}

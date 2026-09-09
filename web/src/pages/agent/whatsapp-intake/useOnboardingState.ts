/**
 * Consumes Wave 4A `useOnboardingState` from `@/hooks/useOnboardingState` when
 * that module exists (`feat/wave-4a-state-hook`). Until it lands, falls back to
 * the Shared Prep stub so WLB screens still compile and auto-mark locally.
 */
import {
  useOnboardingState as usePrepOnboardingState,
  type OnboardingState,
  type OnboardingStatePatch,
  type UseOnboardingStateResult,
} from '@/components/onboarding'
import { completeActivationStep, deferActivationStep, postOnboardingEvent } from './intakeApi'
import { clearWhatsAppResumeBanner, markWhatsAppDeferred } from './tour'

export type { OnboardingState, OnboardingStatePatch, UseOnboardingStateResult }

type HookResult = UseOnboardingStateResult & {
  completeStep?: (
    stepId: string,
    opts?: { completed_via?: string; metadata?: Record<string, unknown> },
  ) => Promise<unknown>
  deferStep?: (stepId: string) => Promise<unknown>
}

type HookModule = { useOnboardingState?: (...args: never[]) => HookResult }

const discovered = import.meta.glob<HookModule>('../../../hooks/useOnboardingState.ts', {
  eager: true,
})

const remoteHook = Object.values(discovered)[0]?.useOnboardingState

export function useOnboardingState(initial?: Partial<OnboardingState>): HookResult {
  const hook = remoteHook ?? usePrepOnboardingState
  return hook(initial as never)
}

export function completedViaCaption(
  state: OnboardingState | HookResult['state'] | undefined,
  stepId: 'whatsapp' | 'first_listing',
): string | null {
  if (!state) return null
  const steps = (state as { steps?: Array<{ id: string; state?: string; completed_via?: string | null }> })
    .steps
  const match = steps?.find((s) => s.id === stepId)
  if (match?.state === 'complete' && match.completed_via) {
    return `Completed via ${match.completed_via}`
  }
  const checklist = (state as OnboardingState).checklist
  if (stepId === 'whatsapp' && checklist?.channels_connected) {
    return 'Completed via whatsapp_intake'
  }
  if (stepId === 'first_listing' && checklist?.first_listing_drafted) {
    return 'Completed via whatsapp_intake'
  }
  return null
}

/** Mark WLB progress on ONB + ACT without re-asking or surveillance banners. */
export async function markWhatsAppIntakeProgress(
  onboarding: HookResult,
  event:
    | { kind: 'deferred' }
    | { kind: 'code_issued' }
    | { kind: 'bound' }
    | { kind: 'draft_ready'; listingId?: string },
): Promise<void> {
  if (event.kind === 'deferred') {
    markWhatsAppDeferred()
    void postOnboardingEvent({ event: 'whatsapp_setup_deferred', tour_step: 2, family: 'whatsapp_intake' })
    void deferActivationStep('whatsapp')
    if (onboarding.patch) {
      void onboarding.patch({ path: 'whatsapp' })
    }
    if (onboarding.deferStep) {
      void onboarding.deferStep('whatsapp')
    }
    return
  }

  if (event.kind === 'code_issued') {
    void postOnboardingEvent({
      event: 'whatsapp_code_issued',
      tour_step: 2,
      family: 'whatsapp_intake',
    })
    if (onboarding.patch) {
      void onboarding.patch({
        path: 'whatsapp',
        step: 'whatsapp_intake_pending',
      })
    }
    return
  }

  if (event.kind === 'bound') {
    void postOnboardingEvent({
      event: 'whatsapp_bound',
      tour_step: 3,
      family: 'whatsapp_intake',
      completed_via: 'whatsapp_intake',
    })
    void completeActivationStep('whatsapp', 'whatsapp_intake')
    if (onboarding.completeStep) {
      void onboarding.completeStep('whatsapp', { completed_via: 'whatsapp_intake' })
    }
    if (onboarding.patch) {
      void onboarding.patch({
        path: 'whatsapp',
        step: 'whatsapp_intake_pending',
        checklist_delta: { channels_connected: true },
      })
    }
    return
  }

  void postOnboardingEvent({
    event: 'whatsapp_tour_completed',
    tour_step: 5,
    family: 'whatsapp_intake',
    listing_id: event.listingId,
    completed_via: 'whatsapp_intake',
  })
  void completeActivationStep('first_listing', 'whatsapp_intake', { listing_id: event.listingId })
  if (onboarding.completeStep) {
    void onboarding.completeStep('first_listing', {
      completed_via: 'whatsapp_intake',
      metadata: { listing_id: event.listingId },
    })
  }
  if (onboarding.patch) {
    void onboarding.patch({
      path: 'whatsapp',
      step: 'draft_review',
      checklist_delta: { first_listing_drafted: true, channels_connected: true },
    })
  }
  clearWhatsAppResumeBanner()
}

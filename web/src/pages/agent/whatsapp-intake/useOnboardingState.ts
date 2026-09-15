/**
 * WLB-local helpers around Wave 4A `useOnboardingState`.
 * Screens import the hook from `@/hooks/useOnboardingState`.
 */
import type { UseOnboardingStateResult } from '@/hooks/useOnboardingState'
import { postOnboardingEvent } from './intakeApi'
import { clearWhatsAppResumeBanner, markWhatsAppDeferred } from './tour'

export type { UseOnboardingStateResult }

export function completedViaCaption(
  onboarding: UseOnboardingStateResult,
  stepId: 'whatsapp' | 'first_listing',
): string | null {
  const via = onboarding.completedVia(stepId)
  return via ? `Completed via ${via}` : null
}

/** Mark WLB progress on ONB + ACT without re-asking or surveillance banners. */
export async function markWhatsAppIntakeProgress(
  onboarding: UseOnboardingStateResult,
  event:
    | { kind: 'deferred' }
    | { kind: 'code_issued' }
    | { kind: 'bound' }
    | { kind: 'draft_ready'; listingId?: string },
): Promise<void> {
  if (event.kind === 'deferred') {
    markWhatsAppDeferred()
    void postOnboardingEvent({ event: 'whatsapp_setup_deferred', tour_step: 2, family: 'whatsapp_intake' })
    void onboarding.deferActivation('whatsapp')
    void onboarding.patch({ path: 'whatsapp' })
    return
  }

  if (event.kind === 'code_issued') {
    void postOnboardingEvent({
      event: 'whatsapp_code_issued',
      tour_step: 2,
      family: 'whatsapp_intake',
    })
    void onboarding.patch({
      path: 'whatsapp',
      step: 'whatsapp_intake_pending',
    })
    return
  }

  if (event.kind === 'bound') {
    void postOnboardingEvent({
      event: 'whatsapp_bound',
      tour_step: 3,
      family: 'whatsapp_intake',
      completed_via: 'whatsapp_intake',
    })
    void onboarding.completeActivation('whatsapp', 'whatsapp_intake')
    void onboarding.patch({
      path: 'whatsapp',
      step: 'whatsapp_intake_pending',
      checklist_delta: { channels_connected: true },
    })
    return
  }

  void postOnboardingEvent({
    event: 'whatsapp_tour_completed',
    tour_step: 5,
    family: 'whatsapp_intake',
    listing_id: event.listingId,
    completed_via: 'whatsapp_intake',
  })
  void onboarding.completeActivation('first_listing', 'whatsapp_intake')
  void onboarding.patch({
    path: 'whatsapp',
    step: 'draft_review',
    checklist_delta: { first_listing_drafted: true, channels_connected: true },
  })
  clearWhatsAppResumeBanner()
}

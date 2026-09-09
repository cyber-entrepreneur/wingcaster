import { describe, expect, it } from 'vitest'
import { makeState } from './testState'
import {
  completedViaCaption,
  elapsedMinutesSince,
  firstNameOf,
  formatCountdown,
  maskPhone,
  resumeRouteForStep,
  roundAgentCount,
  shouldRenderOnboardingChecklist,
  speakCode,
  waMeUrl,
} from './helpers'

describe('shouldRenderOnboardingChecklist', () => {
  it('renders when any main item is incomplete', () => {
    expect(shouldRenderOnboardingChecklist(makeState())).toBe(true)
    expect(shouldRenderOnboardingChecklist(makeState({ step: 'welcome_skipped' }))).toBe(true)
  })

  it('hides when dismissed forever', () => {
    expect(shouldRenderOnboardingChecklist(makeState({ dismissed_forever: true }))).toBe(false)
  })

  it('hides when the four main items are complete (optional paid ignored)', () => {
    expect(
      shouldRenderOnboardingChecklist(
        makeState({
          step: 'complete',
          checklist: {
            welcome_seen: true,
            first_listing_drafted: true,
            first_listing_published: true,
            channels_connected: true,
            notifications_enabled: true,
            profile_completed: true,
            subscription_active: false,
          },
        }),
      ),
    ).toBe(false)
  })

  it('hides when state is missing', () => {
    expect(shouldRenderOnboardingChecklist(null)).toBe(false)
    expect(shouldRenderOnboardingChecklist(undefined)).toBe(false)
  })
})

describe('helpers', () => {
  it('never greets undefined', () => {
    expect(firstNameOf(undefined)).toBeNull()
    expect(firstNameOf('  ')).toBeNull()
    expect(firstNameOf('Sara Agent')).toBe('Sara')
  })

  it('rounds agent counts down to nearest 100', () => {
    expect(roundAgentCount(2499)).toBe(2400)
  })

  it('builds a wa.me URL without putting the code in the path', () => {
    expect(waMeUrl('+97145550199', 'WC-A7K3')).toBe(
      'https://wa.me/97145550199?text=WingCaster%20WC-A7K3',
    )
  })

  it('resumes the matching onboarding route', () => {
    expect(resumeRouteForStep('complete')).toBe('/dashboard')
    expect(resumeRouteForStep('whatsapp_intake_pending')).toBe('/onboarding/whatsapp')
    expect(resumeRouteForStep('first_published')).toBe('/onboarding/first-listing/published')
    expect(resumeRouteForStep('draft_review', 'd1')).toBe('/onboarding/first-listing/d1')
    expect(resumeRouteForStep('welcome')).toBeNull()
  })

  it('formats countdown and speaks the code', () => {
    expect(formatCountdown(12 * 60_000 + 34_000)).toBe('12:34')
    expect(speakCode('WC-A7K3')).toContain('dash')
  })

  it('masks a UAE mobile number', () => {
    expect(maskPhone('+971501234321')).toContain('4321')
  })

  it('shows Completed via {source} without a surveillance banner', () => {
    const state = makeState({
      checklist: {
        ...makeState().checklist,
        first_listing_published: true,
      },
    })
    ;(state as typeof state & { checklist_sources: Record<string, string> }).checklist_sources = {
      first_listing_published: 'whatsapp_intake',
    }
    expect(completedViaCaption(state, 'first_listing_published')).toBe(
      'Completed via WhatsApp intake',
    )
    expect(completedViaCaption(state, 'channels_connected')).toBeNull()
  })

  it('computes elapsed minutes from started_at', () => {
    const started = new Date(Date.now() - 2.4 * 60_000).toISOString()
    expect(elapsedMinutesSince(started)).toBeGreaterThanOrEqual(2)
    expect(elapsedMinutesSince(undefined)).toBeNull()
  })
})

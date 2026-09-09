import type {
  OnboardingChecklistFlags,
  OnboardingState,
  OnboardingStep,
} from '@/components/onboarding/useOnboardingState'

export const ONB_SELECTED_PATH_KEY = 'agtOnb001SelectedPath'
export const ONB_CONFETTI_KEY = 'agtOnb004ConfettiPlayed'
export const ONB_CHECKLIST_EXPANDED_KEY = 'agtOnb005ChecklistExpanded'
export const ONB_SKIP_TOAST_KEY = 'agtOnb001SkipToast'
export const ONB_DISCARD_TOAST_KEY = 'agtOnb003DiscardToast'
export const ONB_CELEBRATION_LISTING_KEY = 'agtOnb004Listing'

export const COMPLETED_VIA_LABELS: Record<string, string> = {
  whatsapp_intake: 'WhatsApp intake',
  onboarding: 'onboarding',
  activation: 'activation',
  dashboard_action: 'dashboard',
  direct: 'direct',
  bulk_import: 'import',
  wlb: 'WhatsApp intake',
  act: 'activation',
}

/** First token of a display name; never returns "undefined". */
export function firstNameOf(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}

export function roundAgentCount(raw: number): number {
  return Math.floor(raw / 100) * 100
}

export function formatAgentCount(count: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US').format(count)
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatSharedNumber(e164: string): string {
  const d = digitsOnly(e164)
  if (d.startsWith('971') && d.length >= 10) {
    return `+971 ${d.slice(3, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  }
  if (e164.startsWith('+')) return e164
  return d ? `+${d}` : e164
}

export function maskPhone(e164: string): string {
  const d = digitsOnly(e164)
  const last4 = d.slice(-4) || '····'
  if (d.startsWith('971')) return `+971 5X XXX ${last4}`
  const cc = d.slice(0, Math.max(1, d.length - 10)) || d.slice(0, 3)
  return `+${cc} XX XXX ${last4}`
}

export function speakCode(code: string): string {
  return code
    .split('')
    .map((ch) => (ch === '-' ? 'dash' : ch.toUpperCase()))
    .join(' ')
}

export function elapsedMinutesSince(startedAt: string | null | undefined): number | null {
  if (!startedAt) return null
  const start = Date.parse(startedAt)
  if (Number.isNaN(start)) return null
  const mins = Math.round((Date.now() - start) / 60_000)
  if (mins < 0) return null
  return Math.max(1, mins)
}

export function readSessionFlag(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSessionFlag(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

export function resumeRouteForStep(
  step: OnboardingStep,
  draftId?: string | null,
): string | null {
  switch (step) {
    case 'complete':
      return '/dashboard'
    case 'whatsapp_intake_pending':
      return '/onboarding/whatsapp'
    case 'draft_review':
      return draftId ? `/onboarding/first-listing/${draftId}` : '/onboarding/whatsapp'
    case 'first_published':
      return '/onboarding/first-listing/published'
    default:
      return null
  }
}

const MAIN_CHECKLIST_KEYS: Array<keyof OnboardingChecklistFlags> = [
  'first_listing_published',
  'channels_connected',
  'notifications_enabled',
  'profile_completed',
]

export function mainChecklistCounts(checklist: OnboardingChecklistFlags): {
  completed: number
  total: number
} {
  const completed = MAIN_CHECKLIST_KEYS.filter((key) => checklist[key]).length
  return { completed, total: MAIN_CHECKLIST_KEYS.length }
}

/**
 * Phase B mount helper — dashboard Zone 3 / Pro pill gate.
 * Hidden when dismissed forever, when state is missing, or when the four
 * main items are complete (100% implies done).
 */
export function shouldRenderOnboardingChecklist(
  state: OnboardingState | null | undefined,
): boolean {
  if (!state) return false
  if (state.dismissed_forever) return false
  const { completed, total } = mainChecklistCounts(state.checklist)
  if (completed >= total) return false
  return true
}

export function completedViaCaption(
  state: OnboardingState,
  key: keyof OnboardingChecklistFlags,
): string | null {
  const extra = state as OnboardingState & {
    checklist_sources?: Partial<Record<keyof OnboardingChecklistFlags, string>>
  }
  const source = extra.checklist_sources?.[key]
  if (!source || !state.checklist[key]) return null
  const label = COMPLETED_VIA_LABELS[source] ?? source
  return `Completed via ${label}`
}

export function waMeUrl(sharedNumberE164: string, activationCode: string): string {
  const n = digitsOnly(sharedNumberE164)
  const text = encodeURIComponent(`WingCaster ${activationCode}`)
  return `https://wa.me/${n}?text=${text}`
}

export function isPatchConflict(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status
  return status === 409
}

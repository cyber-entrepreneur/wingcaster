import type { ActivationStep, CompletedVia, SignupPath } from './types'

export const COMPLETED_VIA_LABEL: Record<string, string> = {
  onboarding: 'onboarding',
  whatsapp_intake: 'WhatsApp intake',
  dashboard_action: 'dashboard',
  direct: 'direct',
  bulk_import: 'bulk import',
}

export function completedViaPhrase(via: CompletedVia | string | null | undefined): string {
  if (!via) return ''
  return COMPLETED_VIA_LABEL[via] ?? String(via).replace(/_/g, ' ')
}

export const COUNTRY_NAMES: Record<string, string> = {
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  LB: 'Lebanon',
  EG: 'Egypt',
  QA: 'Qatar',
  KW: 'Kuwait',
  BH: 'Bahrain',
  OM: 'Oman',
  JO: 'Jordan',
}

export function countryDisplayName(code: string | null | undefined): string {
  if (!code) return 'your country'
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase()
}

export function inviteTeamTitle(path: SignupPath): string {
  if (path === 'agency') return 'Invite your team'
  return "Grow into an agency (when you're ready)"
}

export function inviteTeamDescription(path: SignupPath): string {
  if (path === 'agency') {
    return 'Bring your agents into your workspace. Share a code, a link, or bulk-email invitations.'
  }
  if (path === 'join') {
    return 'Invite is managed by your agency owner.'
  }
  return 'Available if you register an agency workspace later.'
}

export const STEP_COPY: Record<
  string,
  { title: string; description: string; cta: string; resumeCta: string }
> = {
  whatsapp: {
    title: 'Connect WhatsApp',
    description:
      'Bind your business WhatsApp so leads land in your WingCaster inbox from the first hello.',
    cta: 'Start with WhatsApp',
    resumeCta: 'Resume',
  },
  first_listing: {
    title: 'Publish your first listing',
    description: 'Create a listing manually or dictate it over WhatsApp — either path counts.',
    cta: 'Create a listing',
    resumeCta: 'Resume',
  },
  portal_credentials: {
    title: 'Add your portal credentials',
    description:
      'Connect Bayut, Property Finder, Dubizzle, and other portals so WingCaster can publish for you.',
    cta: 'Connect a portal',
    resumeCta: 'Resume',
  },
  working_hours: {
    title: 'Set your working hours & response time',
    description: 'Tell leads when to expect a reply so auto-responders never overpromise.',
    cta: 'Set my hours',
    resumeCta: 'Resume',
  },
  invite_team: {
    title: 'Invite your team',
    description:
      'Bring your agents into your workspace. Share a code, a link, or bulk-email invitations.',
    cta: 'Invite agents',
    resumeCta: 'Resume',
  },
}

export const PORTAL_LOCKED_HELPER =
  "Available soon — we're finalizing your country's portal list."

export function stepLockHelper(step: ActivationStep, signupPath: SignupPath): string | null {
  if (step.state !== 'locked') return null
  if (step.id === 'portal_credentials') return PORTAL_LOCKED_HELPER
  if (step.id === 'invite_team') {
    if (signupPath === 'join' || step.lock_reason === 'join_signup_path') {
      return 'Invite is managed by your agency owner.'
    }
    return 'Available if you register an agency later.'
  }
  return 'Available soon'
}

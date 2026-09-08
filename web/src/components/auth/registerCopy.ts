/**
 * SHR-AUT-006 copy table. Arabic marked [TRANSLATION-PENDING] until MENA copywriter pass.
 */

export type RegisterLocale = 'en' | 'ar'

const AR = '[TRANSLATION-PENDING]'

export const REGISTER_COPY = {
  'page.title': { en: 'Create account · WingCaster', ar: AR },
  'skip.toContent': { en: 'Skip to content', ar: AR },
  'brand.wordmark': { en: 'WingCaster', ar: 'WingCaster' },
  'hero.h1': { en: 'Create your WingCaster account', ar: AR },
  'hero.h1.mobile': { en: 'Create your account', ar: AR },
  'hero.sub': {
    en: 'Cast listings, catch leads, close deals — one system for the whole business.',
    ar: AR,
  },
  'path.heading': { en: 'Who is signing up?', ar: AR },
  'path.solo.label': { en: 'Solo agent', ar: AR },
  'path.solo.desc': { en: 'I work independently. Personal workspace only.', ar: AR },
  'path.join.label': { en: 'Agent joining an agency', ar: AR },
  'path.join.desc': { en: 'I want to work under an existing agency.', ar: AR },
  'path.agency.label': { en: 'Agency owner', ar: AR },
  'path.agency.desc': { en: "I'm registering a new agency workspace.", ar: AR },
  'path.helper': { en: 'You can change or add agencies later from your account.', ar: AR },
  'path.announce.solo': { en: 'Solo agent selected', ar: AR },
  'path.announce.join': { en: 'Agent joining an agency selected', ar: AR },
  'path.announce.agency': { en: 'Agency owner selected', ar: AR },
  'oauth.divider': { en: 'or use your account', ar: AR },
  'oauth.google': { en: 'Continue with Google', ar: AR },
  'oauth.apple': { en: 'Continue with Apple', ar: AR },
  'oauth.facebook': { en: 'Continue with Facebook', ar: AR },
  'signin.link': { en: 'Already have an account?', ar: AR },
  'signin.cta': { en: 'Sign in', ar: AR },
  'trust.footer': {
    en: 'Payments processed by Paddle · Your details are encrypted · GDPR / KSA PDPL / UAE DP Law compliant',
    ar: AR,
  },
  'value.1': { en: 'Capture leads from every channel.', ar: AR },
  'value.2': { en: 'Cast listings to every portal.', ar: AR },
  'value.3': { en: 'Convert conversations into closings.', ar: AR },
  'hero.trusted': { en: 'Trusted by MENA real-estate professionals', ar: AR },
  'hero.illustration.alt': { en: 'Hero illustration — 480×640', ar: AR },
  'hero.illustration.fallback': { en: 'WingCaster', ar: 'WingCaster' },
  'pathB.label': { en: 'Agency slug or invitation code', ar: AR },
  'pathB.placeholder': {
    en: 'e.g. elite-real-estate or a code from your agency owner',
    ar: AR,
  },
  'pathB.browse': { en: 'Or browse agencies accepting applications →', ar: AR },
  'pathB.revealed': { en: 'Agency slug field revealed', ar: AR },
  'pathC.name.label': { en: 'Agency name', ar: AR },
  'pathC.name.placeholder': { en: 'e.g. Elite Real Estate', ar: AR },
  'pathC.legal.label': { en: 'Legal entity type', ar: AR },
  'pathC.market.label': { en: 'Primary market', ar: AR },
  'pathC.consent': {
    en: 'I am authorized to accept these terms on behalf of the agency.',
    ar: AR,
  },
  'pathC.revealed': { en: 'Agency registration fields revealed', ar: AR },
  'offline.banner': {
    en: "You're offline. Reconnect to create your account.",
    ar: AR,
  },
  'dup.title': { en: 'This account already has a WingCaster identity', ar: AR },
  'dup.body': {
    en: 'This identifier or a related one has already claimed a free trial. If this is your account, sign in instead. If you believe this is a mistake, contact support.',
    ar: AR,
  },
  'dup.signin': { en: 'Sign in →', ar: AR },
  'dup.support': { en: 'Contact support', ar: AR },
  'submit.creating': { en: 'Creating account…', ar: AR },
} as const

export type RegisterCopyKey = keyof typeof REGISTER_COPY

export function rt(key: RegisterCopyKey, locale: RegisterLocale): string {
  return REGISTER_COPY[key][locale]
}

export const LEGAL_ENTITY_OPTIONS = [
  { value: 'LLC', label: { en: 'LLC', ar: AR } },
  { value: 'sole_prop', label: { en: 'Sole proprietorship', ar: AR } },
  { value: 'free_zone', label: { en: 'Free zone entity', ar: AR } },
  { value: 'other', label: { en: 'Other', ar: AR } },
] as const

export const PRIMARY_MARKET_OPTIONS = [
  { value: 'UAE', label: { en: 'UAE', ar: AR } },
  { value: 'KSA', label: { en: 'KSA', ar: AR } },
  { value: 'EG', label: { en: 'Egypt', ar: AR } },
  { value: 'LB', label: { en: 'Lebanon', ar: AR } },
  { value: 'other', label: { en: 'Other MENA', ar: AR } },
] as const

export type RegistrationPath = 'solo' | 'join' | 'agency'
export type LegalEntity = (typeof LEGAL_ENTITY_OPTIONS)[number]['value']
export type PrimaryMarket = (typeof PRIMARY_MARKET_OPTIONS)[number]['value']

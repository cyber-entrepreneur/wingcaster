import type { EvidenceFile } from '@/components/forms'
import type { BadComparableReason, ComparableType } from './constants'
import { PRICE_REPORTS_SUBMIT_FEATURE } from './constants'

export type PackageFeatureFlags = Record<string, boolean | undefined>

export type BadComparableFormState = {
  comparable_id: string
  comparable_type: ComparableType
  reason: BadComparableReason | ''
  notes: string
  confidence: 'self_witnessed' | 'hearsay' | 'hard_evidence'
  evidence: EvidenceFile[]
}

export type BadComparableEcho = {
  title: string
  subtitle?: string
  price?: string | number
  area?: string | number
  bedrooms?: string | number
  source?: string
  channel?: string
}

export type PriceReportSubjectKind = 'property' | 'external'

export type PriceReportFormState = {
  subjectKind: PriceReportSubjectKind
  property_id: string
  external_property_title: string
  external_property_location: string
  property_type: string
  bedrooms: string
  bathrooms: string
  area_sqm: string
  sold_price: string
  currency: string
  sold_date: string
  notes: string
  evidence: EvidenceFile[]
}

export type PriceReportEcho = {
  title: string
  subtitle?: string
  price?: string | number
  area?: string | number
  beds?: string | number
}

export function hasPriceReportsSubmitFeature(
  flags: PackageFeatureFlags | null | undefined,
): boolean {
  if (!flags) return false
  return Boolean(flags[PRICE_REPORTS_SUBMIT_FEATURE])
}

/**
 * Derive a flags map from the tenant subscription surface available today.
 * Prefer an explicit `package_feature_flags` / `feature_flags` payload when
 * the backend adds it; otherwise treat Pro-tier packages (BE-BLOCKER-27 seed)
 * as carrying `valuation.price_reports.submit`.
 */
export function flagsFromSubscription(subscription: {
  tier?: string | null
  package_code?: string | null
  package_feature_flags?: PackageFeatureFlags | null
  feature_flags?: PackageFeatureFlags | null
} | null): PackageFeatureFlags {
  const explicit =
    subscription?.package_feature_flags ?? subscription?.feature_flags ?? null
  if (explicit && typeof explicit === 'object') {
    return { ...explicit }
  }

  const tier = (subscription?.tier || '').toLowerCase()
  const code = (subscription?.package_code || '').toLowerCase()
  const isPro =
    tier === 'pro' ||
    code.includes('pro-agent') ||
    code.includes('pro-elite') ||
    code.startsWith('pro')

  return {
    [PRICE_REPORTS_SUBMIT_FEATURE]: isPro,
  }
}

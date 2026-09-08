import type { LucideIcon } from 'lucide-react'
import {
  AlertOctagon,
  Ban,
  FileWarning,
  HelpCircle,
  KeyRound,
  ServerCrash,
} from 'lucide-react'

/**
 * Failure classes from `[BE-BLOCKER-03]` `distribution_attempts.error_class`.
 * Labels + resolution deep links follow AGT-PUB-003 §Error-class → resolution map.
 */
export type PortalErrorClass =
  | 'AUTH_EXPIRED'
  | 'PORTAL_RULES_VIOLATION'
  | 'PORTAL_DOWN'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_CONTENT'
  | 'UNKNOWN_ERROR'

/** Transient classes eligible for bulk "Retry all fixable". */
export const BULK_RETRYABLE_ERROR_CLASSES: readonly PortalErrorClass[] = [
  'PORTAL_DOWN',
  'UNKNOWN_ERROR',
] as const

export const PORTAL_ERROR_CLASSES: readonly PortalErrorClass[] = [
  'AUTH_EXPIRED',
  'PORTAL_RULES_VIOLATION',
  'PORTAL_DOWN',
  'QUOTA_EXCEEDED',
  'INVALID_CONTENT',
  'UNKNOWN_ERROR',
] as const

export const ERROR_CLASS_LABEL: Record<PortalErrorClass, string> = {
  AUTH_EXPIRED: 'Auth expired',
  PORTAL_RULES_VIOLATION: 'Portal rules',
  PORTAL_DOWN: 'Portal down',
  QUOTA_EXCEEDED: 'Quota exceeded',
  INVALID_CONTENT: 'Content rejected',
  UNKNOWN_ERROR: 'Unknown error',
}

export const ERROR_CLASS_ICON: Record<PortalErrorClass, LucideIcon> = {
  AUTH_EXPIRED: KeyRound,
  PORTAL_RULES_VIOLATION: FileWarning,
  PORTAL_DOWN: ServerCrash,
  QUOTA_EXCEEDED: Ban,
  INVALID_CONTENT: AlertOctagon,
  UNKNOWN_ERROR: HelpCircle,
}

/** Primary fix-issue CTA label when a deep link exists. */
export const ERROR_CLASS_FIX_COPY: Partial<Record<PortalErrorClass, string>> = {
  AUTH_EXPIRED: 'Reconnect account',
  PORTAL_RULES_VIOLATION: 'Fix listing',
  QUOTA_EXCEEDED: 'Top up credits',
  INVALID_CONTENT: 'Edit content',
}

/** Secondary fix CTA for QUOTA_EXCEEDED (upgrade path). */
export const ERROR_CLASS_SECONDARY_FIX: Partial<
  Record<PortalErrorClass, { label: string; hrefSuffix: string }>
> = {
  QUOTA_EXCEEDED: { label: 'Upgrade plan', hrefSuffix: '/plans' },
}

export const ERROR_CLASS_HELPER: Partial<Record<PortalErrorClass, string>> = {
  PORTAL_DOWN:
    'The portal is unreachable — usually resolved within an hour.',
}

/**
 * Default resolution deep links when the API omits `fix_deep_link`.
 * Routes map to brief §Error-class → resolution map screens.
 */
export function defaultFixDeepLink(
  errorClass: PortalErrorClass,
  opts: { listingId?: string | null; portalCode?: string | null } = {},
): string | null {
  const listingId = opts.listingId || null
  const portal = opts.portalCode || 'portal'
  switch (errorClass) {
    case 'AUTH_EXPIRED':
      return `/settings/channels?portal=${encodeURIComponent(portal)}`
    case 'PORTAL_RULES_VIOLATION':
    case 'INVALID_CONTENT':
      return listingId ? `/listings/${listingId}` : null
    case 'QUOTA_EXCEEDED':
      return '/my-credits'
    case 'UNKNOWN_ERROR':
      return '/support'
    case 'PORTAL_DOWN':
      return null
  }
}

export function isBulkRetryable(errorClass: PortalErrorClass | null | undefined): boolean {
  return Boolean(errorClass && BULK_RETRYABLE_ERROR_CLASSES.includes(errorClass))
}

export function isPortalErrorClass(value: unknown): value is PortalErrorClass {
  return typeof value === 'string' && (PORTAL_ERROR_CLASSES as readonly string[]).includes(value)
}

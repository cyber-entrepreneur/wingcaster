export const LC_STATUS = ['draft', 'published', 'underOffer', 'closed', 'archived', 'unpublished'] as const
export type LcStatus = (typeof LC_STATUS)[number]

export const LC_STATUS_GLYPH: Record<LcStatus, string> = {
  draft: '○',
  published: '●',
  underOffer: '◐',
  closed: '◆',
  archived: '▢',
  unpublished: '✕',
}

const STATUS_ALIAS: Record<string, LcStatus> = {
  draft: 'draft',
  published: 'published',
  live: 'published',
  active: 'published',
  success: 'published',
  approved: 'published',
  verified: 'published',
  healthy: 'published',
  underoffer: 'underOffer',
  'under-offer': 'underOffer',
  under_offer: 'underOffer',
  pending: 'underOffer',
  paused: 'underOffer',
  warning: 'underOffer',
  queued: 'underOffer',
  closed: 'closed',
  sold: 'closed',
  won: 'closed',
  archived: 'archived',
  inactive: 'archived',
  unpublished: 'unpublished',
  error: 'unpublished',
  failed: 'unpublished',
  rejected: 'unpublished',
  overdue: 'unpublished',
  destructive: 'unpublished',
}

export function resolveLcStatus(value: string | null | undefined): LcStatus {
  if (!value) return 'draft'
  const key = value.replace(/\s+/g, '').toLowerCase()
  return STATUS_ALIAS[key] ?? 'draft'
}

export function lcStatusClasses(status: LcStatus): string {
  return `bg-[var(--lc-status-${status}-bg)] text-[var(--lc-status-${status}-fg)]`
}

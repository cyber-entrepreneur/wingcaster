import type { OutcomeTimelineEvent } from '@/components/recipient'
import type { PublishingDestinationTimelineEntry } from '@/api/client'

const LABEL_BY_KEY: Record<string, string> = {
  submitted: 'Submitted',
  validated: 'Content validated',
  content_validated: 'Content validated',
  sent_to_portal: 'Sent to portal',
  portal_received: 'Portal received',
  portal_decided: 'Decision from portal',
  decided: 'Decision from portal',
}

const LABEL_BY_STATUS: Record<string, string> = {
  pending: 'Submitted',
  queued: 'Submitted',
  submitted: 'Submitted',
  validated: 'Content validated',
  success: 'Decision from portal',
  published: 'Decision from portal',
  live: 'Decision from portal',
  failed: 'Decision from portal',
  rejected: 'Decision from portal',
  pending_retry: 'Sent to portal',
  in_review: 'Portal received',
  pending_moderation: 'Portal received',
}

/**
 * Map backend attempt timeline rows → REC-family OutcomeTimeline events.
 * Falls through to a default 5-step trail when the API returns raw attempts.
 */
export function mapDestinationTimeline(
  entries: PublishingDestinationTimelineEntry[] | undefined,
  opts: { status: 'succeeded' | 'in_review' | 'failed'; eventAt?: string | null } = {
    status: 'in_review',
  },
): OutcomeTimelineEvent[] {
  if (entries && entries.length > 0 && entries.some((e) => e.key || e.label)) {
    return entries.map((e, i) => ({
      key: e.key || e.id || `evt-${i}`,
      label: e.label || LABEL_BY_KEY[e.key || ''] || e.status || 'Event',
      timestamp: e.timestamp || e.attempted_at || undefined,
      state: e.state || (i === entries.length - 1 ? 'current' : 'complete'),
    }))
  }

  // Synthesize from attempt rows or defaults.
  const defaults: OutcomeTimelineEvent[] = [
    { key: 'submitted', label: 'Submitted', state: 'complete' },
    { key: 'validated', label: 'Content validated', state: 'complete' },
    { key: 'sent_to_portal', label: 'Sent to portal', state: 'complete' },
    { key: 'portal_received', label: 'Portal received', state: 'complete' },
    { key: 'portal_decided', label: 'Decision from portal', state: 'pending' },
  ]

  if (!entries?.length) {
    if (opts.status === 'succeeded') {
      return defaults.map((d, i) => ({
        ...d,
        state: 'complete' as const,
        timestamp: i === defaults.length - 1 ? opts.eventAt || undefined : undefined,
      }))
    }
    if (opts.status === 'failed') {
      return defaults.map((d, i) => ({
        ...d,
        state: i === defaults.length - 1 ? ('complete' as const) : d.state,
        timestamp: i === defaults.length - 1 ? opts.eventAt || undefined : undefined,
      }))
    }
    // in_review — decided pending
    return defaults.map((d, i) => ({
      ...d,
      state: i < 4 ? ('complete' as const) : ('current' as const),
      timestamp: i === 0 ? opts.eventAt || undefined : undefined,
    }))
  }

  return entries.map((e, i) => {
    const status = String(e.status || '').toLowerCase()
    return {
      key: e.id || `attempt-${i}`,
      label: LABEL_BY_STATUS[status] || status || 'Attempt',
      timestamp: e.attempted_at || undefined,
      state:
        i === entries.length - 1
          ? opts.status === 'in_review'
            ? ('current' as const)
            : ('complete' as const)
          : ('complete' as const),
    }
  })
}

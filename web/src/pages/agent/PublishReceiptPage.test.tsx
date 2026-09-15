// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AggregateOutcomeHero,
  CreditsSummary,
  ERROR_CLASS_FIX_COPY,
  ERROR_CLASS_ICON,
  ERROR_CLASS_LABEL,
  PORTAL_ERROR_CLASSES,
  PortalReceiptCard,
  defaultFixDeepLink,
  isBulkRetryable,
  type AggregateOutcome,
  type PortalErrorClass,
} from '@/components/portals'
import {
  PublishReceiptScreen,
  buildCtas,
  mapDestinationTimeline,
} from '@/components/publishing/PublishReceiptScreen'
import type { PublishingJobPayload } from '@/api/client'
import { MemoryRouter } from 'react-router-dom'

const PUBLISHED_AT = '2026-09-07T12:04:00Z'

function dest(partial: Partial<PublishingJobPayload['destinations'][number]> & { id: string }) {
  return {
    portal: {
      code: 'property_finder',
      display_name: 'Property Finder',
      logo_url: null,
      country_code: 'AE',
      all_country_codes: ['AE'],
    },
    channel_type: 'realestate',
    status: 'succeeded' as const,
    error_class: null,
    portal_message: null,
    credit_charged: 1,
    credit_reserved: 1,
    event_at: PUBLISHED_AT,
    live_url: 'https://example.com/live',
    retry_available: false,
    fix_deep_link: null,
    moderation_queue_deep_link: null,
    correlation_id: null,
    timeline: [],
    ...partial,
  }
}

function payload(
  aggregate: AggregateOutcome,
  destinations: PublishingJobPayload['destinations'],
): PublishingJobPayload {
  const counts = {
    succeeded: destinations.filter((d) => d.status === 'succeeded').length,
    in_review: destinations.filter((d) => d.status === 'in_review').length,
    failed: destinations.filter((d) => d.status === 'failed').length,
    total: destinations.length,
  }
  return {
    job: {
      id: 'job_5f3a2e1b9c0d',
      listing_id: 'lst_01H8',
      listing_short_ref: '3BR · Downtown Dubai · AED 4.5M',
      aggregate,
      submitted_at: PUBLISHED_AT,
      completed_at: aggregate === 'in_review_only' || aggregate === 'partial' ? null : PUBLISHED_AT,
      counts,
      credits: {
        total_charged: destinations.reduce((s, d) => s + d.credit_charged, 0),
        total_reserved: destinations.reduce((s, d) => s + d.credit_reserved, 0),
      },
    },
    destinations,
  }
}

describe('AGT-PUB-003 failure-class copy + resolution', () => {
  it('exposes all 6 failure classes with glyph + label + fix copy', () => {
    expect(PORTAL_ERROR_CLASSES).toHaveLength(6)
    for (const cls of PORTAL_ERROR_CLASSES) {
      expect(ERROR_CLASS_LABEL[cls]).toBeTruthy()
      expect(ERROR_CLASS_ICON[cls]).toBeTruthy()
    }
    expect(ERROR_CLASS_LABEL.AUTH_EXPIRED).toBe('Auth expired')
    expect(ERROR_CLASS_LABEL.PORTAL_RULES_VIOLATION).toBe('Portal rules')
    expect(ERROR_CLASS_LABEL.PORTAL_DOWN).toBe('Portal down')
    expect(ERROR_CLASS_LABEL.QUOTA_EXCEEDED).toBe('Quota exceeded')
    expect(ERROR_CLASS_LABEL.INVALID_CONTENT).toBe('Content rejected')
    expect(ERROR_CLASS_LABEL.UNKNOWN_ERROR).toBe('Unknown error')

    expect(ERROR_CLASS_FIX_COPY.AUTH_EXPIRED).toBe('Reconnect account')
    expect(ERROR_CLASS_FIX_COPY.PORTAL_RULES_VIOLATION).toBe('Fix listing')
    expect(ERROR_CLASS_FIX_COPY.QUOTA_EXCEEDED).toBe('Top up credits')
    expect(ERROR_CLASS_FIX_COPY.INVALID_CONTENT).toBe('Edit content')
    expect(ERROR_CLASS_FIX_COPY.PORTAL_DOWN).toBeUndefined()
  })

  it('maps resolution deep links per brief', () => {
    expect(defaultFixDeepLink('AUTH_EXPIRED', { portalCode: 'bayut' })).toContain(
      '/settings/channels',
    )
    expect(defaultFixDeepLink('PORTAL_RULES_VIOLATION', { listingId: 'lst_1' })).toBe(
      '/listings/lst_1',
    )
    expect(defaultFixDeepLink('INVALID_CONTENT', { listingId: 'lst_1' })).toBe('/listings/lst_1')
    expect(defaultFixDeepLink('QUOTA_EXCEEDED')).toBe('/my-credits')
    expect(defaultFixDeepLink('PORTAL_DOWN')).toBeNull()
    expect(defaultFixDeepLink('UNKNOWN_ERROR')).toBe('/support')
  })

  it('only PORTAL_DOWN + UNKNOWN_ERROR are bulk-retryable', () => {
    expect(isBulkRetryable('PORTAL_DOWN')).toBe(true)
    expect(isBulkRetryable('UNKNOWN_ERROR')).toBe(true)
    expect(isBulkRetryable('AUTH_EXPIRED')).toBe(false)
    expect(isBulkRetryable('QUOTA_EXCEEDED')).toBe(false)
    expect(isBulkRetryable('INVALID_CONTENT')).toBe(false)
    expect(isBulkRetryable('PORTAL_RULES_VIOLATION')).toBe(false)
  })

  it.each(PORTAL_ERROR_CLASSES)('PortalReceiptCard renders %s label + icon affordance', async (cls) => {
    const user = userEvent.setup()
    render(
      <PortalReceiptCard
        destination={{ portal_code: 'pf', portal_display_name: 'Property Finder', country_code: 'AE' }}
        status="failed"
        error_class={cls}
        credit_charged={0}
        credit_reserved={1}
        timestamp={PUBLISHED_AT}
        retry_available={cls === 'PORTAL_DOWN' || cls === 'UNKNOWN_ERROR'}
        fix_deep_link={defaultFixDeepLink(cls, { listingId: 'lst_1', portalCode: 'pf' }) || undefined}
        correlation_id="cor_abc"
      />,
    )
    expect(screen.getByText(ERROR_CLASS_LABEL[cls])).toBeInTheDocument()
    if (ERROR_CLASS_FIX_COPY[cls]) {
      expect(screen.getByRole('link', { name: ERROR_CLASS_FIX_COPY[cls] })).toBeInTheDocument()
    }
    if (cls === 'PORTAL_DOWN' || cls === 'UNKNOWN_ERROR') {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    }
    if (cls === 'UNKNOWN_ERROR') {
      expect(screen.getByText(/Correlation cor_abc/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'Show submission timeline' }))
    expect(screen.getByRole('button', { name: 'Hide submission timeline' })).toBeInTheDocument()
  })
})

describe('AGT-PUB-003 AggregateOutcomeHero state variants', () => {
  const cases: Array<{
    aggregate: AggregateOutcome
    label: RegExp
    loud: boolean
  }> = [
    { aggregate: 'all_succeeded', label: /Published to 3 of 3 destinations/, loud: true },
    { aggregate: 'mixed', label: /Published to 1 of 3 destinations/, loud: false },
    { aggregate: 'all_failed', label: /Publish didn't complete/, loud: false },
    { aggregate: 'in_review_only', label: /Awaiting portal moderation/, loud: false },
    { aggregate: 'partial', label: /Published — some destinations still pending/, loud: false },
  ]

  it.each(cases)('$aggregate renders correct label + loud discipline', ({ aggregate, label, loud }) => {
    const counts =
      aggregate === 'all_succeeded'
        ? { succeeded: 3, in_review: 0, failed: 0 }
        : aggregate === 'all_failed'
          ? { succeeded: 0, in_review: 0, failed: 3 }
          : aggregate === 'in_review_only'
            ? { succeeded: 0, in_review: 3, failed: 0 }
            : aggregate === 'partial'
              ? { succeeded: 2, in_review: 1, failed: 0 }
              : { succeeded: 1, in_review: 1, failed: 1 }

    const { container } = render(
      <AggregateOutcomeHero
        aggregate={aggregate}
        counts={counts}
        total_destinations={3}
        published_at={PUBLISHED_AT}
      />,
    )
    expect(screen.getByRole('heading', { name: label })).toBeInTheDocument()
    expect(container.querySelector('[data-emphasis]')).toHaveAttribute(
      'data-emphasis',
      loud ? 'loud' : 'default',
    )
    // Counter pills always present (zeros muted, not hidden)
    expect(screen.getByText(/succeeded/)).toBeInTheDocument()
    expect(screen.getByText(/in review/)).toBeInTheDocument()
    expect(screen.getByText(/failed/)).toBeInTheDocument()
  })

  it('only all_succeeded uses loud emphasis', () => {
    const aggregates: AggregateOutcome[] = [
      'all_succeeded',
      'mixed',
      'all_failed',
      'in_review_only',
      'partial',
    ]
    for (const aggregate of aggregates) {
      const { container, unmount } = render(
        <AggregateOutcomeHero
          aggregate={aggregate}
          counts={{ succeeded: 1, in_review: 1, failed: 1 }}
          total_destinations={3}
          published_at={PUBLISHED_AT}
        />,
      )
      const emphasis = container.querySelector('[data-emphasis]')?.getAttribute('data-emphasis')
      if (aggregate === 'all_succeeded') expect(emphasis).toBe('loud')
      else expect(emphasis).toBe('default')
      unmount()
    }
  })
})

describe('AGT-PUB-003 PublishReceiptScreen — 8 state variants', () => {
  function renderScreen(p: PublishingJobPayload, extras?: { offline?: boolean; retryingIds?: Set<string> }) {
    return render(
      <MemoryRouter>
        <PublishReceiptScreen
          payload={p}
          offline={extras?.offline}
          retryingIds={extras?.retryingIds}
        />
      </MemoryRouter>,
    )
  }

  it('ALL_SUCCEEDED — live group + view listings CTA', () => {
    renderScreen(
      payload('all_succeeded', [
        dest({ id: 'd1', status: 'succeeded' }),
        dest({ id: 'd2', status: 'succeeded', portal: { code: 'bayut', display_name: 'Bayut', logo_url: null, country_code: 'AE', all_country_codes: ['AE'] } }),
      ]),
    )
    expect(screen.getByRole('heading', { name: /Published to 2 of 2/ })).toBeInTheDocument()
    expect(screen.getByText(/Live now \(2\)/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /View my listings/i }).length).toBeGreaterThan(0)
  })

  it('MIXED — three groups + credits release line', () => {
    renderScreen(
      payload('mixed', [
        dest({
          id: 'f1',
          status: 'failed',
          error_class: 'PORTAL_RULES_VIOLATION',
          credit_charged: 0,
          credit_reserved: 1,
          retry_available: false,
          fix_deep_link: '/listings/lst_01H8',
        }),
        dest({ id: 'r1', status: 'in_review', moderation_queue_deep_link: '/listings/lst_01H8/submissions/r1' }),
        dest({ id: 's1', status: 'succeeded' }),
      ]),
    )
    expect(screen.getByText(/Needs your attention \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Awaiting portal moderation \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Live now \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/released to your balance/i)).toBeInTheDocument()
    expect(screen.getByText('Portal rules')).toBeInTheDocument()
  })

  it('ALL_FAILED — covers all 6 error classes', () => {
    const classes = [...PORTAL_ERROR_CLASSES] as PortalErrorClass[]
    renderScreen(
      payload(
        'all_failed',
        classes.map((error_class, i) =>
          dest({
            id: `f${i}`,
            status: 'failed',
            error_class,
            credit_charged: 0,
            credit_reserved: 1,
            retry_available: error_class === 'PORTAL_DOWN' || error_class === 'UNKNOWN_ERROR',
            portal: {
              code: `p${i}`,
              display_name: `Portal ${i}`,
              logo_url: null,
              country_code: 'AE',
              all_country_codes: ['AE'],
            },
          }),
        ),
      ),
    )
    for (const cls of classes) {
      expect(screen.getByText(ERROR_CLASS_LABEL[cls])).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: /Retry all fixable/i }).length).toBeGreaterThan(0)
  })

  it('IN_REVIEW_ONLY — queue CTA', () => {
    renderScreen(
      payload('in_review_only', [
        dest({ id: 'r1', status: 'in_review', moderation_queue_deep_link: '/q/1' }),
        dest({ id: 'r2', status: 'in_review', moderation_queue_deep_link: '/q/2' }),
      ]),
    )
    expect(
      screen.getAllByRole('heading', { name: /Awaiting portal moderation/ }).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /View submission queue/i }).length).toBeGreaterThan(0)
  })

  it('PARTIAL — failed pill present at zero via hero counts', () => {
    renderScreen(
      payload('partial', [
        dest({ id: 's1', status: 'succeeded' }),
        dest({ id: 'r1', status: 'in_review' }),
      ]),
    )
    expect(
      screen.getByRole('heading', { name: /Published — some destinations still pending/ }),
    ).toBeInTheDocument()
    // zero failed still announced
    expect(screen.getByLabelText(/0 failed/i)).toBeInTheDocument()
  })

  it('cross-country — separate cards per country code', () => {
    renderScreen(
      payload('mixed', [
        dest({
          id: 'ae',
          status: 'succeeded',
          portal: {
            code: 'property_finder',
            display_name: 'Property Finder',
            logo_url: null,
            country_code: 'AE',
            all_country_codes: ['AE'],
          },
        }),
        dest({
          id: 'sa',
          status: 'in_review',
          portal: {
            code: 'property_finder',
            display_name: 'Property Finder',
            logo_url: null,
            country_code: 'SA',
            all_country_codes: ['SA'],
          },
        }),
        dest({
          id: 'eg',
          status: 'failed',
          error_class: 'PORTAL_DOWN',
          credit_charged: 0,
          retry_available: true,
          portal: {
            code: 'property_finder',
            display_name: 'Property Finder',
            logo_url: null,
            country_code: 'EG',
            all_country_codes: ['EG'],
          },
        }),
        dest({
          id: 'lb',
          status: 'succeeded',
          portal: {
            code: 'property_finder',
            display_name: 'Property Finder',
            logo_url: null,
            country_code: 'LB',
            all_country_codes: ['LB'],
          },
        }),
      ]),
    )
    expect(screen.getAllByText('Property Finder')).toHaveLength(4)
    expect(screen.getByLabelText('AE')).toBeInTheDocument()
    expect(screen.getByLabelText('SA')).toBeInTheDocument()
    expect(screen.getByLabelText('EG')).toBeInTheDocument()
    expect(screen.getByLabelText('LB')).toBeInTheDocument()
  })

  it('retry-in-flight — aria-busy + Retrying label', () => {
    renderScreen(
      payload('mixed', [
        dest({
          id: 'f1',
          status: 'failed',
          error_class: 'PORTAL_DOWN',
          credit_charged: 0,
          retry_available: true,
        }),
        dest({ id: 's1', status: 'succeeded' }),
      ]),
      { retryingIds: new Set(['f1']) },
    )
    expect(screen.getAllByText('Retrying…').length).toBeGreaterThan(0)
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  it('offline — banner + disabled retry', () => {
    renderScreen(
      payload('mixed', [
        dest({
          id: 'f1',
          status: 'failed',
          error_class: 'PORTAL_DOWN',
          credit_charged: 0,
          retry_available: true,
        }),
        dest({ id: 's1', status: 'succeeded' }),
      ]),
      { offline: true },
    )
    expect(screen.getByText(/You're offline/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled()
  })
})

describe('CreditsSummary always renders', () => {
  it('shows charged === reserved without release line', () => {
    render(
      <CreditsSummary
        total_charged={4}
        total_reserved={4}
        credits_history_deep_link="/my-credits"
      />,
    )
    expect(screen.getByText(/4 credits charged/)).toBeInTheDocument()
    expect(screen.queryByText(/released to your balance/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View credits history/i })).toBeInTheDocument()
  })
})

describe('CTA map + timeline mapper', () => {
  it('buildCtas maps aggregate → primary labels', () => {
    expect(
      buildCtas({
        aggregate: 'all_succeeded',
        listingId: 'l1',
        destinations: [],
      }).primary.label,
    ).toBe('View my listings')
    expect(
      buildCtas({
        aggregate: 'in_review_only',
        listingId: 'l1',
        destinations: [],
      }).primary.label,
    ).toBe('View submission queue')
    expect(
      buildCtas({
        aggregate: 'all_failed',
        listingId: 'l1',
        destinations: [
          dest({ id: 'x', status: 'failed', error_class: 'PORTAL_DOWN', retry_available: true }),
        ],
      }).primary.label,
    ).toBe('Retry all fixable')
  })

  it('mapDestinationTimeline synthesizes 5 events', () => {
    const events = mapDestinationTimeline([], { status: 'in_review', eventAt: PUBLISHED_AT })
    expect(events).toHaveLength(5)
    expect(events[0].label).toBe('Submitted')
    expect(events[4].label).toBe('Decision from portal')
    expect(events[4].state).toBe('current')
  })
})

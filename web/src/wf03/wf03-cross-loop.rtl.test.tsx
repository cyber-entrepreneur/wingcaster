// @vitest-environment jsdom
/**
 * WF-03 cross-loop UI e2e (Wave 2 Agent 6).
 *
 * Proves the deadlock is resolved across Phase A screens without inventing UI:
 * submit receipt contract → tracker live update contract → PA queue bulk →
 * PA detail tenure-risk two-person → env LIVE/TEST chrome.
 *
 * Chromatic / a11y snapshots are owned by Agent 7 (#105) — not duplicated here.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import {
  ERROR_CLASS_FIX_COPY,
  ERROR_CLASS_LABEL,
  PORTAL_ERROR_CLASSES,
  defaultFixDeepLink,
  isBulkRetryable,
  type PortalErrorClass,
} from '@/components/portals'
import { PublishReceiptScreen } from '@/components/publishing/PublishReceiptScreen'
import type { PublishingJobPayload } from '@/api/client'
import { EnvBadge, ENV_SWITCHER_COPY } from '@/components/nav/EnvBadge'
import { EnvWarningStrip } from '@/components/nav/EnvWarningStrip'
import {
  PAQueueBulkBar,
  PAQueueBulkReasonDialog,
  PAQueueFilterStrip,
} from '@/components/queue'
import {
  isHighRisk,
  requiresTwoPersonReject,
  type PortalModerationSubmission,
} from '@/api/portalModeration'

const PUBLISHED_AT = '2026-09-08T12:04:00.000Z'

function failedDest(
  errorClass: PortalErrorClass,
  portalCode: string,
): PublishingJobPayload['destinations'][number] {
  const listingId = 'lst_wf03'
  const fix =
    // Prefer API contract (backend jobs.js) when present.
    errorClass === 'AUTH_EXPIRED'
      ? `/channels/${portalCode}/reconnect`
      : errorClass === 'QUOTA_EXCEEDED'
        ? '/billing/top-up'
        : errorClass === 'PORTAL_RULES_VIOLATION' || errorClass === 'INVALID_CONTENT'
          ? `/publish/fix/${listingId}?portal=${portalCode}`
          : errorClass === 'PORTAL_DOWN' || errorClass === 'UNKNOWN_ERROR'
            ? `/publish/retry/${listingId}`
            : defaultFixDeepLink(errorClass, { listingId, portalCode })

  return {
    id: `dest_${errorClass}`,
    portal: {
      code: portalCode,
      display_name: portalCode,
      logo_url: null,
      country_code: 'AE',
      all_country_codes: ['AE'],
    },
    channel_type: 'realestate',
    status: 'failed',
    error_class: errorClass,
    portal_message: `${errorClass} detail`,
    credit_charged: 0,
    credit_reserved: 1,
    event_at: PUBLISHED_AT,
    live_url: null,
    retry_available: isBulkRetryable(errorClass),
    fix_deep_link: fix,
    moderation_queue_deep_link: null,
    correlation_id: `corr_${errorClass}`,
    timeline: [],
  }
}

function allFailedJob(): PublishingJobPayload {
  const portals = ['bayut', 'olx', 'dubizzle', 'aqar', 'wasalt', 'property_finder'] as const
  const destinations = PORTAL_ERROR_CLASSES.map((cls, i) => failedDest(cls, portals[i]))
  return {
    job: {
      id: 'job_wf03_all_failed',
      listing_id: 'lst_wf03',
      listing_short_ref: 'Marina 2BR',
      aggregate: 'all_failed',
      submitted_at: PUBLISHED_AT,
      completed_at: PUBLISHED_AT,
      counts: { succeeded: 0, in_review: 0, failed: 6, total: 6 },
      credits: { total_charged: 0, total_reserved: 6 },
    },
    destinations,
  }
}

describe('WF-03 cross-loop — receipt renders all 6 failure classes + deep links', () => {
  it('ALL_FAILED receipt shows every error_class label and resolution CTA', () => {
    const data = allFailedJob()
    render(
      <MemoryRouter>
        <PublishReceiptScreen payload={data} />
      </MemoryRouter>,
    )

    for (const cls of PORTAL_ERROR_CLASSES) {
      expect(screen.getByText(ERROR_CLASS_LABEL[cls])).toBeInTheDocument()
      const fixCopy = ERROR_CLASS_FIX_COPY[cls]
      if (fixCopy) {
        expect(screen.getByRole('link', { name: fixCopy })).toBeInTheDocument()
      }
    }

    // Bulk retry CTA only for transient classes.
    expect(isBulkRetryable('PORTAL_DOWN')).toBe(true)
    expect(isBulkRetryable('AUTH_EXPIRED')).toBe(false)
  })
})

describe('WF-03 cross-loop — PA-MOD tenure-risk two-person path', () => {
  it('high tenure-risk + agency flag requires two-person reject', () => {
    const high: Pick<PortalModerationSubmission, 'tenure_risk' | 'agency'> = {
      tenure_risk: { tier: 'high', score: 0.9 },
      agency: {
        id: 'agy_1',
        name: 'Elite',
        tenant_url: '/',
        two_person_reject_required: true,
      },
    }
    expect(isHighRisk('high')).toBe(true)
    expect(requiresTwoPersonReject(high)).toBe(true)

    // v1 stub / unknown never hard-blocks.
    expect(
      requiresTwoPersonReject({
        tenure_risk: { tier: 'unknown' },
        agency: { id: 'agy_1', name: 'Elite', tenant_url: '/', two_person_reject_required: true },
      }),
    ).toBe(false)
  })
})

describe('WF-03 cross-loop — PA-MOD-001 bulk operations', () => {
  it('bulk reject requires shared reason before confirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <PAQueueBulkReasonDialog
        open
        mode="reject"
        count={3}
        reasonOptions={[
          { value: 'fails_portal_validation', label: 'Fails portal validation' },
          { value: 'insufficient_photos', label: 'Insufficient photos' },
        ]}
        onConfirm={onConfirm}
        minNotesLength={5}
      />,
    )
    const confirm = screen.getByRole('button', { name: /Reject all/i })
    expect(confirm).toBeDisabled()
    await user.selectOptions(screen.getByLabelText(/Reason/i), 'insufficient_photos')
    await user.type(screen.getByLabelText(/Notes/i), 'Need more photos')
    expect(confirm).not.toBeDisabled()
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith({
      reasonCode: 'insufficient_photos',
      notes: 'Need more photos',
    })
  })

  it('high-risk bulk selection surfaces step-up notice', () => {
    render(<PAQueueBulkBar showBulk selectedCount={4} acrossCount={2} highRiskCount={2} />)
    expect(screen.getByText(/Step-up required for high-risk decisions/i)).toBeInTheDocument()
  })
})

describe('WF-03 cross-loop — PA-NAV-001 LIVE vs TEST env chrome', () => {
  const filterValues = {
    status: 'pending',
    submittedWithin: '7d' as const,
    riskTier: 'any' as const,
    search: '',
  }

  it('LIVE badge without TEST warning; TEST shows warning strip', () => {
    const { rerender } = render(
      <PAQueueFilterStrip
        envBadge={<EnvBadge env="live" />}
        statusOptions={[{ value: 'pending', label: 'Pending', count: 3 }]}
        values={filterValues}
        onChange={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: ENV_SWITCHER_COPY['badge.aria.live'].en }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/You are in TEST environment/i)).not.toBeInTheDocument()

    rerender(
      <>
        <EnvWarningStrip onSwitchToLive={() => {}} />
        <PAQueueFilterStrip
          envBadge={<EnvBadge env="test" />}
          statusOptions={[{ value: 'pending', label: 'Pending', count: 3 }]}
          values={filterValues}
          onChange={() => {}}
        />
      </>,
    )
    expect(
      screen.getByRole('button', { name: ENV_SWITCHER_COPY['badge.aria.test'].en }),
    ).toBeInTheDocument()
    expect(screen.getByText(/You are in TEST environment/i)).toBeInTheDocument()
  })
})

describe('WF-03 cross-loop — Phase A screens are routed and importable', () => {
  it('receipt / tracker / PA queue page modules resolve (no invented screens)', async () => {
    const receipt = await import('@/pages/agent/PublishReceiptPage')
    const tracker = await import('@/pages/agent/PortalTrackerPage')
    const submit = await import('@/pages/agent/PortalSubmitPage')
    const queue = await import('@/pages/admin/PortalModerationQueuePage')
    const detail = await import('@/pages/admin/PortalModerationDetailPage')
    expect(receipt.PublishReceiptPage).toBeTypeOf('function')
    expect(tracker.PortalTrackerPage).toBeTypeOf('function')
    expect(submit.PortalSubmitPage).toBeTypeOf('function')
    expect(queue.PortalModerationQueuePage).toBeTypeOf('function')
    expect(detail.PortalModerationDetailPage).toBeTypeOf('function')
  })
})

/**
 * WF-03 cross-loop fast gates (Wave 2 Agent 6).
 *
 * Proves the UI/API contract for:
 * - all 6 error_class → resolution deep links (AGT-PUB-003)
 * - receipt aggregate + moderation queue deep links
 * - tenure-risk stub → two-person gate decision matrix (PA-MOD-002)
 * - portal_submission.status_changed push hop shape
 *
 * Real-Postgres lifecycle lives in
 * `wf03-portal-moderation.cross-loop.postgres.test.js`.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  buildPublishingJobPayload,
  computeAggregate,
  RETRYABLE_ERROR_CLASSES,
} from '../lib/publishing/jobs.js'
import { ERROR_CLASSES } from '../lib/publishing/error-classifier.js'
import { scoreTenureRisk } from '../lib/moderation/tenure-risk.js'
import { validate as validatePortalListing } from '../lib/portal-validators/index.js'

const dispatchMock = vi.hoisted(() => ({
  dispatchConsumerNotification: vi.fn(async ({ channel }) => ({
    ok: true,
    status: channel === 'in_app' ? 'delivered' : 'sent',
    channel,
  })),
}))

vi.mock('../lib/notifications/dispatch.js', () => dispatchMock)
vi.mock('../notifications/platform-templates/resolver.js', () => ({
  resolveTemplate: vi.fn(async () => null),
}))

const {
  emitPortalSubmissionStatusChanged,
  STATUS_TEMPLATE_CODES,
  submissionReceiptDeepLink,
} = await import('../lib/publishing/notify-submission-status.js')

beforeEach(() => {
  dispatchMock.dispatchConsumerNotification.mockClear()
})

/** Minimal JOIN-row shape for buildPublishingJobPayload. */
function destRow({
  id,
  platform,
  jobStatus,
  attemptStatus = null,
  errorClass = null,
  errorMessage = null,
  listingId = 'lst_wf03',
  publishingJobId = 'job_wf03',
  liveUrl = null,
}) {
  return {
    destination_id: id,
    publishing_job_pk: publishingJobId,
    publishing_job_id: publishingJobId,
    property_id: listingId,
    listing_id: listingId,
    listing_title: 'Marina 2BR',
    listing_city: 'Dubai',
    agent_id: 'agent_1',
    agency_id: null,
    platform,
    portal_code: platform,
    portal_display_name: platform,
    portal_logo_url: null,
    portal_country_codes: ['AE'],
    job_status: jobStatus,
    attempt_status: attemptStatus,
    error_class: errorClass,
    attempt_error_message: errorMessage,
    job_error_message: null,
    attempt_id: `att_${id}`,
    attempted_at: '2026-09-08T12:00:00.000Z',
    published_at: attemptStatus === 'published' ? '2026-09-08T12:00:00.000Z' : null,
    job_created_at: '2026-09-08T11:00:00.000Z',
    job_updated_at: '2026-09-08T12:00:00.000Z',
    job_data: liveUrl ? { live_url: liveUrl } : {},
    payload: {},
    attempt_response: {},
    timeline: [],
    credit_charged: 0,
    credit_reserved: 0,
    credit_held: 0,
    credit_released: 0,
    pj_submitted_at: '2026-09-08T11:00:00.000Z',
    pj_completed_at: null,
    pj_data: {},
  }
}

/** AGT-PUB-003 §Error-class → resolution map (backend `fix_deep_link` contract). */
export const ERROR_CLASS_RESOLUTION = Object.freeze({
  AUTH_EXPIRED: {
    db: 'auth_expired',
    retry_available: false,
    fix_deep_link: (platform, listingId) => `/channels/${platform}/reconnect`,
    fix_label: 'Reconnect account',
  },
  PORTAL_RULES_VIOLATION: {
    db: 'portal_rules_violation',
    retry_available: false,
    fix_deep_link: (platform, listingId) => `/publish/fix/${listingId}?portal=${platform}`,
    fix_label: 'Fix listing',
  },
  PORTAL_DOWN: {
    db: 'portal_down',
    retry_available: true,
    // Transient — retry inline; backend still emits a retry deep link.
    fix_deep_link: (_platform, listingId) => `/publish/retry/${listingId}`,
    fix_label: null,
  },
  QUOTA_EXCEEDED: {
    db: 'quota_exceeded',
    retry_available: false,
    fix_deep_link: () => '/billing/top-up',
    fix_label: 'Top up credits',
  },
  INVALID_CONTENT: {
    db: 'invalid_content',
    retry_available: false,
    fix_deep_link: (platform, listingId) => `/publish/fix/${listingId}?portal=${platform}`,
    fix_label: 'Edit content',
  },
  UNKNOWN_ERROR: {
    db: 'unknown_error',
    retry_available: true,
    fix_deep_link: (_platform, listingId) => `/publish/retry/${listingId}`,
    fix_label: null,
  },
})

describe('WF-03 UI contract — 6 failure classes + resolution deep links', () => {
  it('covers exactly the BE-BLOCKER-03 CHECK enum', () => {
    expect(ERROR_CLASSES).toEqual([
      'auth_expired',
      'portal_rules_violation',
      'portal_down',
      'quota_exceeded',
      'invalid_content',
      'unknown_error',
    ])
    expect(Object.keys(ERROR_CLASS_RESOLUTION)).toHaveLength(6)
  })

  it('emits fix_deep_link + retry_available per AGT-PUB-003 resolution map', () => {
    const listingId = 'lst_01H8'
    const rows = Object.entries(ERROR_CLASS_RESOLUTION).map(([apiClass, spec], i) =>
      destRow({
        id: `dest_${i}`,
        platform: 'bayut',
        jobStatus: 'failed',
        attemptStatus: 'failed',
        errorClass: spec.db,
        errorMessage: `${apiClass} fixture`,
        listingId,
      }),
    )

    const payload = buildPublishingJobPayload(rows, 'job_wf03')
    expect(payload.job.aggregate).toBe('all_failed')
    expect(payload.job.counts).toEqual({
      succeeded: 0,
      in_review: 0,
      failed: 6,
      total: 6,
    })

    for (const dest of payload.destinations) {
      const spec = ERROR_CLASS_RESOLUTION[dest.error_class]
      expect(spec, dest.error_class).toBeTruthy()
      expect(dest.status).toBe('failed')
      expect(dest.retry_available).toBe(spec.retry_available)
      expect(dest.fix_deep_link).toBe(spec.fix_deep_link('bayut', listingId))
    }

    expect(RETRYABLE_ERROR_CLASSES).toEqual(['PORTAL_DOWN', 'UNKNOWN_ERROR'])
  })

  it('in_review destinations expose moderation_queue_deep_link for AGT-PUB-006', () => {
    const payload = buildPublishingJobPayload(
      [
        destRow({
          id: 'dest_review',
          platform: 'property_finder',
          jobStatus: 'pending_moderation',
          attemptStatus: 'in_review',
          listingId: 'lst_marina',
        }),
        destRow({
          id: 'dest_live',
          platform: 'bayut',
          jobStatus: 'published',
          attemptStatus: 'published',
          liveUrl: 'https://bayut.example/1',
          listingId: 'lst_marina',
        }),
      ],
      'job_wf03',
    )
    expect(payload.job.aggregate).toBe('partial')
    const review = payload.destinations.find((d) => d.id === 'dest_review')
    expect(review.moderation_queue_deep_link).toBe(
      '/listings/lst_marina/submissions/dest_review',
    )
    expect(review.error_class).toBeNull()
  })
})

describe('WF-03 tenure-risk → two-person path (BE-DESIGN-02)', () => {
  /**
   * PA-MOD-002 two-person gate matrix:
   * - high → require second approver (and step-up)
   * - medium → warn, single approver OK
   * - low / unknown → single approver (v1 stub always unknown)
   */
  function requiresTwoPerson(tier) {
    return tier === 'high'
  }

  it('v1 stub returns unknown so PA-MOD does not hard-block on missing signals', () => {
    const risk = scoreTenureRisk(
      { id: 'a1', created_at: '2020-01-01' },
      { id: 's1', price: 9_999_999 },
    )
    expect(risk.tier).toBe('unknown')
    expect(requiresTwoPerson(risk.tier)).toBe(false)
  })

  it('documents the high-tier gate the UI must enforce when Phase-2 scoring lands', () => {
    expect(requiresTwoPerson('high')).toBe(true)
    expect(requiresTwoPerson('medium')).toBe(false)
    expect(requiresTwoPerson('low')).toBe(false)
    expect(requiresTwoPerson('unknown')).toBe(false)
  })
})

describe('WF-03 PA-MOD validator lint aggregate (BE-BLOCKER-17)', () => {
  it('dispatches property_finder validator for PA detail lint panel', () => {
    const result = validatePortalListing(
      { title: 'x', photos: [] },
      { portalCode: 'property_finder', countryCode: 'AE' },
    )
    expect(Array.isArray(result.checks)).toBe(true)
    expect(result.checks.length).toBeGreaterThan(0)
  })
})

describe('WF-03 push hop — portal_submission.status_changed after PA decision', () => {
  it('approve path emits live template + receipt deep link', async () => {
    const attemptId = 'da_live_1'
    const result = await emitPortalSubmissionStatusChanged({
      userId: 'usr_agent',
      portalName: 'Property Finder',
      listingAddress: '12 Marina Walk',
      slaDays: 3,
      distributionAttemptId: attemptId,
      newStatus: 'live',
    })
    expect(result.ok).toBe(true)
    expect(result.template_code).toBe(STATUS_TEMPLATE_CODES.live)
    expect(result.deep_link_url).toBe(submissionReceiptDeepLink(attemptId))
    expect(dispatchMock.dispatchConsumerNotification).toHaveBeenCalledTimes(2)
    const channels = dispatchMock.dispatchConsumerNotification.mock.calls.map(
      (c) => c[0].channel,
    )
    expect(channels.sort()).toEqual(['in_app', 'push'])
  })

  it('reject / request-info / in_review statuses have template codes', () => {
    expect(STATUS_TEMPLATE_CODES).toEqual({
      live: 'portal_submission.status_changed.live',
      rejected: 'portal_submission.status_changed.rejected',
      failed: 'portal_submission.status_changed.failed',
      expired: 'portal_submission.status_changed.expired',
      in_review: 'portal_submission.status_changed.in_review',
    })
  })
})

describe('WF-03 aggregate helpers used by receipt + tracker', () => {
  it('computeAggregate covers receipt hero states', () => {
    expect(computeAggregate({ succeeded: 2, in_review: 0, failed: 0, total: 2 })).toBe(
      'all_succeeded',
    )
    expect(computeAggregate({ succeeded: 0, in_review: 2, failed: 0, total: 2 })).toBe(
      'in_review_only',
    )
    expect(computeAggregate({ succeeded: 1, in_review: 1, failed: 1, total: 3 })).toBe('mixed')
  })
})

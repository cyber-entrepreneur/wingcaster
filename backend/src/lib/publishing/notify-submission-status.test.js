/**
 * Fast unit tests for BE-BLOCKER-12 emitPortalSubmissionStatusChanged.
 * Variable substitution + in_review cooldown via alert_type + priority.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dispatchMock = vi.hoisted(() => ({
  dispatchConsumerNotification: vi.fn(async ({ channel }) => ({
    ok: true,
    status: channel === 'in_app' ? 'delivered' : 'sent',
    channel,
  })),
}))

const resolverMock = vi.hoisted(() => ({
  resolveTemplate: vi.fn(async () => null),
}))

vi.mock('../notifications/dispatch.js', () => dispatchMock)
vi.mock('../../notifications/platform-templates/resolver.js', () => resolverMock)

const {
  emitPortalSubmissionStatusChanged,
  STATUS_TEMPLATE_CODES,
  IN_REVIEW_ALERT_TYPE,
  submissionReceiptDeepLink,
  FALLBACK_COPY,
} = await import('./notify-submission-status.js')

beforeEach(() => {
  dispatchMock.dispatchConsumerNotification.mockClear()
  resolverMock.resolveTemplate.mockReset().mockResolvedValue(null)
})

const BASE = {
  userId: 'usr_agent01',
  portalName: 'Bayut',
  listingAddress: 'Marina Gate, Dubai',
  slaDays: 14,
  distributionAttemptId: 'da_abc123',
}

describe('emitPortalSubmissionStatusChanged', () => {
  it('substitutes portal_name / listing_address / sla_days in fallback copy', async () => {
    const live = await emitPortalSubmissionStatusChanged({ ...BASE, newStatus: 'live' })
    expect(live.used_fallback).toBe(true)
    expect(live.template_code).toBe(STATUS_TEMPLATE_CODES.live)
    const liveCall = dispatchMock.dispatchConsumerNotification.mock.calls[0][0]
    expect(liveCall.subject).toBe('Bayut accepted your listing')
    expect(liveCall.body).toBe('Marina Gate, Dubai is now live on Bayut.')

    dispatchMock.dispatchConsumerNotification.mockClear()
    const expired = await emitPortalSubmissionStatusChanged({ ...BASE, newStatus: 'expired' })
    const expiredCall = dispatchMock.dispatchConsumerNotification.mock.calls[0][0]
    expect(expiredCall.subject).toBe('Submission to Bayut timed out')
    expect(expiredCall.body).toBe('No portal response after 14 days. Tap to see options.')
    expect(expired.template_code).toBe(STATUS_TEMPLATE_CODES.expired)
  })

  it('uses template resolver output when a seed row is returned', async () => {
    resolverMock.resolveTemplate.mockResolvedValue({
      id: 'tpl_live',
      subject: '{{portal_name}} accepted your listing',
      html_body: null,
      text_body: '{{listing_address}} is now live on {{portal_name}}.',
    })
    const result = await emitPortalSubmissionStatusChanged({ ...BASE, newStatus: 'live' })
    expect(result.used_fallback).toBe(false)
    expect(result.used_template_id).toBe('tpl_live')
    expect(resolverMock.resolveTemplate).toHaveBeenCalledWith({
      code: STATUS_TEMPLATE_CODES.live,
      language: 'en',
    })
  })

  it('in_review uses cooldown alert_type + priority=normal', async () => {
    await emitPortalSubmissionStatusChanged({ ...BASE, newStatus: 'in_review' })
    const calls = dispatchMock.dispatchConsumerNotification.mock.calls.map((c) => c[0])
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.metadata.alert_type).toBe(IN_REVIEW_ALERT_TYPE)
      expect(call.metadata.priority).toBe('normal')
      expect(call.metadata.deep_link_url).toBe(submissionReceiptDeepLink(BASE.distributionAttemptId))
    }
    expect(calls.map((c) => c.channel).sort()).toEqual(['in_app', 'push'])
    expect(calls[0].subject).toBe('Bayut started reviewing your listing')
    expect(calls[0].body).toBe("You'll get another update when they decide.")
  })

  it('live / rejected / failed / expired are immediate (priority=urgent)', async () => {
    for (const newStatus of ['live', 'rejected', 'failed', 'expired']) {
      dispatchMock.dispatchConsumerNotification.mockClear()
      await emitPortalSubmissionStatusChanged({ ...BASE, newStatus })
      const meta = dispatchMock.dispatchConsumerNotification.mock.calls[0][0].metadata
      expect(meta.priority).toBe('urgent')
      expect(meta.alert_type).toBe(STATUS_TEMPLATE_CODES[newStatus === 'live' ? 'live' : newStatus])
    }
  })

  it('dispatches in-app + push to the same user with the receipts deep-link', async () => {
    const result = await emitPortalSubmissionStatusChanged({ ...BASE, newStatus: 'rejected' })
    expect(result.deep_link_url).toBe('wingcaster://publishing/receipts/da_abc123')
    expect(result.in_app.ok).toBe(true)
    expect(result.push.ok).toBe(true)
    expect(FALLBACK_COPY.rejected.subject).toContain('{{portal_name}}')
  })

  it('returns UNKNOWN_STATUS for unsupported transitions', async () => {
    const result = await emitPortalSubmissionStatusChanged({ ...BASE, newStatus: 'queued' })
    expect(result).toMatchObject({ ok: false, code: 'UNKNOWN_STATUS' })
    expect(dispatchMock.dispatchConsumerNotification).not.toHaveBeenCalled()
  })
})

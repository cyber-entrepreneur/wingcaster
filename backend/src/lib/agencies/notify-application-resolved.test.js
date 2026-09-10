/**
 * Fast unit tests for Wave 1 WF-02 emitAgencyApplicationResolved.
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
  emitAgencyApplicationResolved,
  safeEmitAgencyApplicationResolved,
  RESOLVED_TEMPLATE_CODES,
  applicationOutcomeDeepLink,
  applicationOutcomeWebPath,
  FALLBACK_COPY,
} = await import('./notify-application-resolved.js')

beforeEach(() => {
  dispatchMock.dispatchConsumerNotification.mockClear()
  resolverMock.resolveTemplate.mockReset().mockResolvedValue(null)
})

const BASE = {
  userId: 'usr_agent01',
  agencyName: 'Palm Realty',
  applicationId: 'app_abc123',
}

describe('emitAgencyApplicationResolved', () => {
  it('substitutes agency_name in fallback copy for all three variants', async () => {
    const approved = await emitAgencyApplicationResolved({ ...BASE, newStatus: 'approved' })
    expect(approved.used_fallback).toBe(true)
    expect(approved.template_code).toBe(RESOLVED_TEMPLATE_CODES.approved)
    const approvedCall = dispatchMock.dispatchConsumerNotification.mock.calls[0][0]
    expect(approvedCall.subject).toBe('Palm Realty accepted your application')
    expect(approvedCall.body).toBe('Welcome. Tap to switch to your new workspace.')

    dispatchMock.dispatchConsumerNotification.mockClear()
    const rejected = await emitAgencyApplicationResolved({ ...BASE, newStatus: 'rejected' })
    const rejectedCall = dispatchMock.dispatchConsumerNotification.mock.calls[0][0]
    expect(rejectedCall.subject).toBe('Palm Realty responded to your application')
    expect(rejectedCall.body).toBe('Your application was reviewed. Tap to see the outcome.')
    expect(rejected.template_code).toBe(RESOLVED_TEMPLATE_CODES.rejected)

    dispatchMock.dispatchConsumerNotification.mockClear()
    const expired = await emitAgencyApplicationResolved({ ...BASE, newStatus: 'expired' })
    const expiredCall = dispatchMock.dispatchConsumerNotification.mock.calls[0][0]
    expect(expiredCall.subject).toBe('Your application to Palm Realty timed out')
    expect(expiredCall.body).toBe(
      'No response after 30 days. Tap to re-apply or browse other agencies.',
    )
    expect(expired.template_code).toBe(RESOLVED_TEMPLATE_CODES.expired)
  })

  it('uses template resolver output when a seed row is returned', async () => {
    resolverMock.resolveTemplate.mockResolvedValue({
      id: 'tpl_approved',
      subject: '{{agency_name}} accepted your application',
      html_body: null,
      text_body: 'Welcome. Tap to switch to your new workspace.',
    })
    const result = await emitAgencyApplicationResolved({ ...BASE, newStatus: 'approved' })
    expect(result.used_fallback).toBe(false)
    expect(result.used_template_id).toBe('tpl_approved')
    expect(resolverMock.resolveTemplate).toHaveBeenCalledWith({
      code: RESOLVED_TEMPLATE_CODES.approved,
      language: 'en',
    })
  })

  it('dispatches in-app + push with applications deep-link (urgent)', async () => {
    const result = await emitAgencyApplicationResolved({ ...BASE, newStatus: 'rejected' })
    expect(result.deep_link_url).toBe(applicationOutcomeDeepLink(BASE.applicationId))
    expect(result.web_path).toBe(applicationOutcomeWebPath(BASE.applicationId))
    expect(result.deep_link_url).toBe('wingcaster://applications/app_abc123')
    expect(result.web_path).toBe('/applications/app_abc123')
    expect(result.in_app.ok).toBe(true)
    expect(result.push.ok).toBe(true)

    const calls = dispatchMock.dispatchConsumerNotification.mock.calls.map((c) => c[0])
    expect(calls).toHaveLength(2)
    expect(calls.map((c) => c.channel).sort()).toEqual(['in_app', 'push'])
    for (const call of calls) {
      expect(call.metadata.priority).toBe('urgent')
      expect(call.metadata.alert_type).toBe(RESOLVED_TEMPLATE_CODES.rejected)
      expect(call.metadata.deep_link_url).toBe('wingcaster://applications/app_abc123')
      expect(call.metadata.web_path).toBe('/applications/app_abc123')
      expect(call.recipient).toBe(BASE.userId)
    }
    expect(FALLBACK_COPY.approved.subject).toContain('{{agency_name}}')
  })

  it('returns UNKNOWN_STATUS / MISSING_USER without dispatching', async () => {
    const unknown = await emitAgencyApplicationResolved({ ...BASE, newStatus: 'pending' })
    expect(unknown).toMatchObject({ ok: false, code: 'UNKNOWN_STATUS' })
    expect(dispatchMock.dispatchConsumerNotification).not.toHaveBeenCalled()

    const missing = await emitAgencyApplicationResolved({
      ...BASE,
      userId: null,
      newStatus: 'approved',
    })
    expect(missing).toMatchObject({ ok: false, code: 'MISSING_USER' })
  })

  it('safeEmit logs and continues when emit throws', async () => {
    dispatchMock.dispatchConsumerNotification.mockRejectedValueOnce(new Error('boom'))
    const result = await safeEmitAgencyApplicationResolved({ ...BASE, newStatus: 'approved' })
    expect(result).toMatchObject({ ok: false, code: 'EMIT_FAILED' })
  })
})

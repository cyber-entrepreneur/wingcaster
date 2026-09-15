import { describe, expect, it } from 'vitest'
import { REDACTED, scrubPii, scrubValue, isSensitiveKey, Sentry } from './sentry'

describe('frontend scrubPii', () => {
  it('flags sensitive keys', () => {
    expect(isSensitiveKey('email')).toBe(true)
    expect(isSensitiveKey('token')).toBe(true)
    expect(isSensitiveKey('user_id')).toBe(false)
  })

  it('redacts email/phone/token from a fixture request body', () => {
    const scrubbed = scrubValue({
      email: 'agent@wingcaster.test',
      phone: '+96171123456',
      token: 'secret',
      user_id: '11111111-1111-4111-8111-111111111111',
    }) as Record<string, unknown>

    expect(scrubbed.email).toBe(REDACTED)
    expect(scrubbed.phone).toBe(REDACTED)
    expect(scrubbed.token).toBe(REDACTED)
    expect(scrubbed.user_id).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('scrubs a Sentry event object via beforeSend', () => {
    const event = {
      request: {
        data: {
          email: 'a@b.com',
          phone: '+15550109999',
          token: 'xyz',
        },
        query_string: 'email=a@b.com&tenant_id=t-1',
      },
      user: {
        id: 'u-1',
        email: 'a@b.com',
      },
    }

    const scrubbed = scrubPii(event as Sentry.ErrorEvent)
    expect(scrubbed).not.toBeNull()
    const data = scrubbed!.request!.data as Record<string, unknown>
    expect(data.email).toBe(REDACTED)
    expect(data.phone).toBe(REDACTED)
    expect(data.token).toBe(REDACTED)
    expect(scrubbed!.request!.query_string).toContain(`email=${REDACTED}`)
    expect(scrubbed!.request!.query_string).toContain('tenant_id=t-1')
    expect(scrubbed!.user).toEqual({ id: 'u-1' })
  })
})

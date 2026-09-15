import { describe, expect, it } from 'vitest'
import {
  REDACTED,
  scrubPii,
  scrubQueryString,
  scrubValue,
  isSensitiveKey,
} from './sentry.js'

describe('isSensitiveKey', () => {
  it('flags passwords, tokens, OTP, email, phone, name, session ids', () => {
    for (const key of [
      'password',
      'token',
      'access_token',
      'otp',
      'otp_code',
      'backup_codes',
      'email',
      'phone',
      'name',
      'session_id',
      'ssn',
      'credit_card',
      'Authorization',
    ]) {
      expect(isSensitiveKey(key)).toBe(true)
    }
  })

  it('allows UUID identity and HTTP metadata keys', () => {
    for (const key of ['user_id', 'tenant_id', 'agency_id', 'route', 'method', 'status_code']) {
      expect(isSensitiveKey(key)).toBe(false)
    }
  })
})

describe('scrubValue', () => {
  it('redacts sensitive keys in a fixture request body', () => {
    const body = {
      email: 'agent@wingcaster.test',
      phone: '+96171123456',
      token: 'super-secret-jwt',
      password: 'hunter2',
      otp: '123456',
      backup_codes: ['AAAA-BBBB', 'CCCC-DDDD'],
      user_id: '11111111-1111-4111-8111-111111111111',
      tenant_id: '22222222-2222-4222-8222-222222222222',
      nested: {
        access_token: 'abc',
        agency_id: '33333333-3333-4333-8333-333333333333',
      },
    }

    const scrubbed = scrubValue(body)

    expect(scrubbed.email).toBe(REDACTED)
    expect(scrubbed.phone).toBe(REDACTED)
    expect(scrubbed.token).toBe(REDACTED)
    expect(scrubbed.password).toBe(REDACTED)
    expect(scrubbed.otp).toBe(REDACTED)
    expect(scrubbed.backup_codes).toBe(REDACTED)
    expect(scrubbed.user_id).toBe('11111111-1111-4111-8111-111111111111')
    expect(scrubbed.tenant_id).toBe('22222222-2222-4222-8222-222222222222')
    expect(scrubbed.nested.access_token).toBe(REDACTED)
    expect(scrubbed.nested.agency_id).toBe('33333333-3333-4333-8333-333333333333')
  })

  it('masks email/phone plaintext embedded in free-text fields', () => {
    const scrubbed = scrubValue({
      note: 'contact agent@wingcaster.test or +1 (555) 010-9999',
    })
    expect(scrubbed.note).not.toContain('agent@wingcaster.test')
    expect(scrubbed.note).toContain(REDACTED)
  })
})

describe('scrubQueryString', () => {
  it('redacts sensitive query params', () => {
    const scrubbed = scrubQueryString('email=a@b.com&token=xyz&user_id=u-1')
    expect(scrubbed).toContain(`email=${REDACTED}`)
    expect(scrubbed).toContain(`token=${REDACTED}`)
    expect(scrubbed).toContain('user_id=u-1')
  })
})

describe('scrubPii (Sentry beforeSend)', () => {
  it('redacts request body, query string, and user context on a fixture event', () => {
    const event = {
      request: {
        url: '/api/auth/login',
        method: 'POST',
        data: {
          email: 'pa@wingcaster.test',
          phone: '+96170111222',
          token: 'session-token-should-die',
          password: 'not-for-sentry',
        },
        query_string: 'email=leak@test.com&tenant_id=t-1',
        headers: {
          authorization: 'Bearer abc',
          'content-type': 'application/json',
        },
        cookies: { sid: 'cookie-value' },
      },
      user: {
        id: '44444444-4444-4444-8444-444444444444',
        email: 'pa@wingcaster.test',
        username: 'platform-admin',
        ip_address: '203.0.113.10',
      },
      extra: {
        otp: '999999',
        route: '/api/auth/login',
      },
      breadcrumbs: [
        {
          category: 'auth',
          message: 'login fail for agent@wingcaster.test',
          data: { password: 'nope', user_id: 'u-9' },
        },
      ],
    }

    const scrubbed = scrubPii(event)

    expect(scrubbed.request.data.email).toBe(REDACTED)
    expect(scrubbed.request.data.phone).toBe(REDACTED)
    expect(scrubbed.request.data.token).toBe(REDACTED)
    expect(scrubbed.request.data.password).toBe(REDACTED)
    expect(scrubbed.request.query_string).toContain(`email=${REDACTED}`)
    expect(scrubbed.request.query_string).toContain('tenant_id=t-1')
    expect(scrubbed.request.headers.authorization).toBe(REDACTED)
    expect(scrubbed.request.headers['content-type']).toBe('application/json')
    expect(scrubbed.request.cookies).toBe(REDACTED)
    expect(scrubbed.user).toEqual({ id: '44444444-4444-4444-8444-444444444444' })
    expect(scrubbed.extra.otp).toBe(REDACTED)
    expect(scrubbed.extra.route).toBe('/api/auth/login')
    expect(scrubbed.breadcrumbs[0].data.password).toBe(REDACTED)
    expect(scrubbed.breadcrumbs[0].data.user_id).toBe('u-9')
    expect(scrubbed.breadcrumbs[0].message).not.toContain('agent@wingcaster.test')
  })
})

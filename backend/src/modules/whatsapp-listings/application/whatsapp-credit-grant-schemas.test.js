import { describe, expect, it } from 'vitest'
import { whatsAppCreditGrantBodySchema } from './whatsapp-credit-grant-schemas.js'

describe('whatsAppCreditGrantBodySchema', () => {
  it('accepts a valid grant body', () => {
    const parsed = whatsAppCreditGrantBodySchema.parse({
      scope: 'agent',
      scope_id: 'agent-123',
      amount_usd: 25,
      reason: 'Goodwill credit for intake outage',
    })
    expect(parsed.amount_usd).toBe(25)
  })

  it('rejects invalid scope and unknown keys', () => {
    expect(() =>
      whatsAppCreditGrantBodySchema.parse({
        scope: 'tenant',
        scope_id: 'x',
        amount_usd: 1,
        reason: 'x',
      }),
    ).toThrow()
    expect(() =>
      whatsAppCreditGrantBodySchema.parse({
        scope: 'agent',
        scope_id: 'x',
        amount_usd: 1,
        reason: 'x',
        source: 'promo',
      }),
    ).toThrow()
  })

  it('requires a non-empty reason', () => {
    expect(() =>
      whatsAppCreditGrantBodySchema.parse({
        scope: 'agency',
        scope_id: 'agency-1',
        amount_usd: 10,
        reason: '   ',
      }),
    ).toThrow()
  })
})

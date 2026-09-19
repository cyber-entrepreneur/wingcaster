import { describe, expect, it } from 'vitest'
import {
  accountingPeriodActionBodySchema,
  accountingPeriodReopenBodySchema,
} from './accounting-period-schemas.js'

describe('accounting-period-schemas', () => {
  it('accepts empty close action bodies', () => {
    expect(accountingPeriodActionBodySchema.safeParse({}).success).toBe(true)
  })

  it('rejects unknown close action fields', () => {
    expect(accountingPeriodActionBodySchema.safeParse({ environment: 'LIVE' }).success).toBe(false)
  })

  it('accepts reopen approval identifiers', () => {
    const parsed = accountingPeriodReopenBodySchema.safeParse({
      approval_request_id: '00000000-0000-4000-8000-000000000001',
      reason_code: 'TEST',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid reopen approval ids', () => {
    expect(accountingPeriodReopenBodySchema.safeParse({ approval_request_id: 'not-a-uuid' }).success).toBe(false)
  })
})

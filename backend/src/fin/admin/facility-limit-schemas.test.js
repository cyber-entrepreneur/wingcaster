import { describe, expect, it } from 'vitest'
import { amendFacilityLimitBodySchema } from './facility-limit-schemas.js'

describe('amendFacilityLimitBodySchema', () => {
  it('accepts a valid limit amendment body', () => {
    const parsed = amendFacilityLimitBodySchema.safeParse({
      limit_minor: 5000,
      reason_code: 'FACILITY_LIMIT_INCREASE',
      approval_request_id: '00000000-0000-0000-0000-000000000001',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects unknown fields', () => {
    expect(amendFacilityLimitBodySchema.safeParse({
      limit_minor: 5000,
      reason_code: 'FACILITY_LIMIT_INCREASE',
      approval_request_id: '00000000-0000-0000-0000-000000000001',
      environment: 'LIVE',
    }).success).toBe(false)
  })

  it('rejects missing approval_request_id', () => {
    expect(amendFacilityLimitBodySchema.safeParse({
      limit_minor: 5000,
      reason_code: 'FACILITY_LIMIT_INCREASE',
    }).success).toBe(false)
  })
})

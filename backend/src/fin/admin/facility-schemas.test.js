import { describe, expect, it } from 'vitest'
import { createFacilityBodySchema } from './facility-schemas.js'

describe('createFacilityBodySchema', () => {
  const valid = {
    tenant_id: '00000000-0000-0000-0000-000000000001',
    billing_account_id: '00000000-0000-0000-0000-000000000002',
    currency: 'USD',
    limit_minor: 5000,
    net_terms_days: 30,
    reason_code: 'FACILITY_ONBOARDING',
  }

  it('accepts a valid create payload', () => {
    expect(createFacilityBodySchema.safeParse(valid).success).toBe(true)
  })

  it('rejects unknown fields', () => {
    const parsed = createFacilityBodySchema.safeParse({ ...valid, environment: 'LIVE' })
    expect(parsed.success).toBe(false)
  })

  it('rejects invalid currency length', () => {
    const parsed = createFacilityBodySchema.safeParse({ ...valid, currency: 'US' })
    expect(parsed.success).toBe(false)
  })
})

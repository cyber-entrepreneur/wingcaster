import { describe, expect, it } from 'vitest'
import { reconcileVendorStatementBodySchema } from './vendor-statement-schemas.js'

describe('reconcileVendorStatementBodySchema', () => {
  it('accepts evidence payload', () => {
    const parsed = reconcileVendorStatementBodySchema.safeParse({
      evidence: { signed: true, note: 'ok' },
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects unknown keys', () => {
    const parsed = reconcileVendorStatementBodySchema.safeParse({
      evidence: { signed: true },
      extra: true,
    })
    expect(parsed.success).toBe(false)
  })
})

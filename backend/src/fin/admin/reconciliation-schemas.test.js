import { describe, expect, it } from 'vitest'
import { runReconciliationBodySchema, scopeFromRunBody } from './reconciliation-schemas.js'

describe('runReconciliationBodySchema', () => {
  it('accepts platform scope', () => {
    const parsed = runReconciliationBodySchema.safeParse({ scope_kind: 'platform' })
    expect(parsed.success).toBe(true)
    expect(scopeFromRunBody(parsed.data)).toBe('platform')
  })

  it('accepts tenant scope with tenant_id', () => {
    const parsed = runReconciliationBodySchema.safeParse({
      scope_kind: 'tenant',
      tenant_id: '00000000-0000-0000-0000-000000000001',
    })
    expect(parsed.success).toBe(true)
    expect(scopeFromRunBody(parsed.data)).toBe('tenant:00000000-0000-0000-0000-000000000001')
  })

  it('accepts check scope with check_code', () => {
    const parsed = runReconciliationBodySchema.safeParse({
      scope_kind: 'check',
      check_code: 'R001',
    })
    expect(parsed.success).toBe(true)
    expect(scopeFromRunBody(parsed.data)).toBe('check:R001')
  })

  it('rejects tenant scope without tenant_id', () => {
    expect(runReconciliationBodySchema.safeParse({ scope_kind: 'tenant' }).success).toBe(false)
  })

  it('rejects unknown fields', () => {
    expect(runReconciliationBodySchema.safeParse({
      scope_kind: 'platform',
      environment: 'LIVE',
    }).success).toBe(false)
  })
})

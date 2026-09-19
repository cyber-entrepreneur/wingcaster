import { describe, expect, it } from 'vitest'
import { invoiceDebitNoteBodySchema } from './invoice-debit-note-schemas.js'

describe('invoiceDebitNoteBodySchema (PA-INV-004)', () => {
  it('accepts a positive amount_minor', () => {
    const parsed = invoiceDebitNoteBodySchema.parse({ amount_minor: 500 })
    expect(parsed.amount_minor).toBe(500)
  })

  it('rejects missing or non-positive amounts', () => {
    expect(() => invoiceDebitNoteBodySchema.parse({})).toThrow()
    expect(() => invoiceDebitNoteBodySchema.parse({ amount_minor: 0 })).toThrow()
    expect(() => invoiceDebitNoteBodySchema.parse({ amount_minor: -1 })).toThrow()
  })

  it('rejects unknown fields', () => {
    expect(() => invoiceDebitNoteBodySchema.parse({ amount_minor: 1, tenant_id: 'x' })).toThrow()
  })
})

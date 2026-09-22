/**
 * Full CRM contact form — create/update schema validation (AGT-CTC).
 */
import { describe, expect, it } from 'vitest'
import { contactCreateSchema, contactUpdateSchema } from './validation.js'

describe('contactCreateSchema', () => {
  it('requires at least one identity field', () => {
    expect(contactCreateSchema.safeParse({ title: 'CEO' }).success).toBe(false)
  })

  it('accepts a name-only contact', () => {
    expect(contactCreateSchema.safeParse({ first_name: 'Ada' }).success).toBe(true)
  })

  it('accepts identity supplied only via emails[] or phones[]', () => {
    expect(contactCreateSchema.safeParse({ emails: [{ address: 'a@b.com' }] }).success).toBe(true)
    expect(contactCreateSchema.safeParse({ phones: [{ number: '+9715' }] }).success).toBe(true)
  })

  it('rejects an unknown contact_role', () => {
    expect(contactCreateSchema.safeParse({ name: 'X', contact_role: 'wizard' }).success).toBe(false)
  })

  it('coerces budget_amount from a string', () => {
    const r = contactCreateSchema.safeParse({ name: 'X', budget_amount: '250000' })
    expect(r.success).toBe(true)
    expect(r.data.budget_amount).toBe(250000)
  })

  it('defaults the phone/email label', () => {
    const r = contactCreateSchema.safeParse({ phones: [{ number: '+1' }], emails: [{ address: 'a@b.com' }] })
    expect(r.success).toBe(true)
    expect(r.data.phones[0].label).toBe('mobile')
    expect(r.data.emails[0].label).toBe('personal')
  })

  it('strips unknown keys so the API stays forward-compatible', () => {
    const r = contactCreateSchema.safeParse({ name: 'X', bogus_field: 'nope' })
    expect(r.success).toBe(true)
    expect(r.data.bogus_field).toBeUndefined()
  })
})

describe('contactUpdateSchema', () => {
  it('accepts an empty patch (every field optional)', () => {
    expect(contactUpdateSchema.safeParse({}).success).toBe(true)
  })

  it('validates nested property_interests and financial_institutions', () => {
    const r = contactUpdateSchema.safeParse({
      property_interests: { preferred_area: 'Downtown', required_features: ['pool'] },
      financial_institutions: [{ name: 'Chase', relationship: 'lender' }],
      source_of_funds: 'cash',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid source_of_funds', () => {
    expect(contactUpdateSchema.safeParse({ source_of_funds: 'gold_bars' }).success).toBe(false)
  })

  it('rejects an invalid qualification_status', () => {
    expect(contactUpdateSchema.safeParse({ qualification_status: 'maybe' }).success).toBe(false)
  })
})

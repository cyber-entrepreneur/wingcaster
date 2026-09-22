import { describe, expect, it } from 'vitest'
import {
  emptyContactFormState,
  formStateFromContact,
  formStateToPayload,
} from './contactForm'

describe('contactForm model', () => {
  it('emptyContactFormState has stable defaults', () => {
    const s = emptyContactFormState()
    expect(s.status).toBe('lead')
    expect(s.phones).toEqual([{ label: 'mobile', number: '' }])
    expect(s.emails).toEqual([{ label: 'personal', address: '' }])
    expect(s.children).toEqual([])
    expect(s.email_opt_out).toBe(false)
  })

  describe('formStateToPayload', () => {
    it('omits empty sections and trims scalars', () => {
      const s = emptyContactFormState()
      s.first_name = '  Ada  '
      s.contact_role = 'buyer'
      const payload = formStateToPayload(s)
      expect(payload.first_name).toBe('Ada')
      expect(payload.contact_role).toBe('buyer')
      // Empty arrays/objects are not sent.
      expect(payload.phones).toBeUndefined()
      expect(payload.emails).toBeUndefined()
      expect(payload.address).toBeUndefined()
      expect(payload.property_interests).toBeUndefined()
      // status is always sent (has a default).
      expect(payload.status).toBe('lead')
    })

    it('filters blank phone/email rows and keeps labeled ones', () => {
      const s = emptyContactFormState()
      s.phones = [
        { label: 'mobile', number: ' +9715 ' },
        { label: 'business', number: '' },
      ]
      s.emails = [{ label: 'personal', address: '' }]
      const payload = formStateToPayload(s)
      expect(payload.phones).toEqual([{ label: 'mobile', number: '+9715' }])
      expect(payload.emails).toBeUndefined()
    })

    it('coerces budget_amount to a number and only sends true booleans', () => {
      const s = emptyContactFormState()
      s.budget_amount = '250000'
      s.do_not_call = true
      s.email_opt_out = false
      const payload = formStateToPayload(s)
      expect(payload.budget_amount).toBe(250000)
      expect(payload.do_not_call).toBe(true)
      expect(payload.email_opt_out).toBeUndefined()
    })

    it('sends property_interests only when a field is filled, trimming features', () => {
      const s = emptyContactFormState()
      s.property_interests.preferred_area = 'Downtown'
      s.property_interests.required_features = ['pool ', '', ' garden']
      const payload = formStateToPayload(s) as {
        property_interests?: { required_features: string[]; preferred_area: string }
      }
      expect(payload.property_interests?.preferred_area).toBe('Downtown')
      expect(payload.property_interests?.required_features).toEqual(['pool', 'garden'])
    })
  })

  describe('formStateFromContact', () => {
    it('falls back to scalar email/phone columns when no labeled arrays stored', () => {
      const s = formStateFromContact({ id: 'c1', email: 'a@b.com', phone: '+9715', first_name: 'Ada' })
      expect(s.emails).toEqual([{ label: 'personal', address: 'a@b.com' }])
      expect(s.phones).toEqual([{ label: 'mobile', number: '+9715' }])
      expect(s.first_name).toBe('Ada')
    })

    it('prefers stored labeled arrays and nested blocks', () => {
      const s = formStateFromContact({
        id: 'c1',
        phones: [{ label: 'business', number: '+111' }],
        emails: [{ label: 'business', address: 'work@x.com' }],
        address: { city: 'Beirut' },
        budget_amount: 500000,
        do_not_call: true,
        children: [{ name: 'Kid', dob: '2015-01-01' }],
      })
      expect(s.phones).toEqual([{ label: 'business', number: '+111' }])
      expect(s.address.city).toBe('Beirut')
      expect(s.budget_amount).toBe('500000')
      expect(s.do_not_call).toBe(true)
      expect(s.children).toEqual([{ name: 'Kid', dob: '2015-01-01' }])
    })
  })
})

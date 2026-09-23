import { describe, expect, it } from 'vitest'
import { buildContactActions } from './contactQuickActions'

const byKey = (actions: ReturnType<typeof buildContactActions>) =>
  Object.fromEntries(actions.map((a) => [a.key, a]))

describe('buildContactActions', () => {
  it('returns nothing for a contact with no reachable channels', () => {
    expect(buildContactActions({ id: 'c1' })).toEqual([])
  })

  it('builds mailto/tel/sms/wa.me from scalar email + phone', () => {
    const a = byKey(buildContactActions({ id: 'c1', email: 'ada@x.com', phone: '+961 3 111 222' }))
    expect(a.email.href).toBe('mailto:ada@x.com')
    expect(a.email.external).toBe(false)
    expect(a.call.href).toBe('tel:+961 3 111 222')
    expect(a.sms.href).toBe('sms:+961 3 111 222')
    // WhatsApp target strips to digits.
    expect(a.whatsapp.href).toBe('https://wa.me/9613111222')
    expect(a.whatsapp.external).toBe(true)
  })

  it('falls back to the first labeled email/phone when no scalar is set', () => {
    const a = byKey(buildContactActions({
      id: 'c1',
      emails: [{ label: 'business', address: 'work@x.com' }],
      phones: [{ label: 'mobile', number: '+15551234' }],
    }))
    expect(a.email.href).toBe('mailto:work@x.com')
    expect(a.call.href).toBe('tel:+15551234')
  })

  it('prefers an explicit whatsapp handle over the phone', () => {
    const a = byKey(buildContactActions({ id: 'c1', phone: '+111', socials: { whatsapp: '+99988877' } }))
    expect(a.whatsapp.href).toBe('https://wa.me/99988877')
  })

  it('normalizes social handles and passes through full URLs', () => {
    const a = byKey(buildContactActions({
      id: 'c1',
      socials: {
        telegram: '@ada_tg',
        instagram: 'ada.ig',
        facebook: 'https://facebook.com/ada.custom',
        twitter: '@ada_x',
        tiktok: 'ada_tt',
        linkedin: 'https://linkedin.com/in/ada-pro',
      },
    }))
    expect(a.telegram.href).toBe('https://t.me/ada_tg')
    expect(a.instagram.href).toBe('https://instagram.com/ada.ig')
    expect(a.facebook.href).toBe('https://facebook.com/ada.custom') // full URL kept
    expect(a.twitter.href).toBe('https://x.com/ada_x')
    expect(a.tiktok.href).toBe('https://tiktok.com/@ada_tt')
    expect(a.linkedin.href).toBe('https://linkedin.com/in/ada-pro')
  })
})

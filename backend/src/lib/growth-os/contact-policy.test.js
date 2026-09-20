/**
 * Wave 2E — ContactPolicy unit coverage (quiet hours / DNC / rule normalize).
 */
import { describe, expect, it } from 'vitest'
import {
  isInQuietHours,
  isInDoNotContactWindow,
  normalizeRules,
} from './contact-policy.js'

describe('contact-policy helpers', () => {
  it('normalizes empty rules', () => {
    expect(normalizeRules(undefined)).toEqual({
      frequency_caps: [],
      quiet_hours: null,
      do_not_contact_windows: [],
      campaign_priority: [],
      negotiation_suppression: false,
    })
  })

  it('detects quiet hours wrapping midnight', () => {
    const quiet = {
      timezone: 'UTC',
      windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '08:00' }],
    }
    expect(isInQuietHours(quiet, new Date('2026-09-20T23:30:00Z'))).toBe(true)
    expect(isInQuietHours(quiet, new Date('2026-09-20T07:00:00Z'))).toBe(true)
    expect(isInQuietHours(quiet, new Date('2026-09-20T12:00:00Z'))).toBe(false)
  })

  it('honours do-not-contact windows by channel', () => {
    const windows = [{
      start: '2026-09-20T00:00:00Z',
      end: '2026-09-21T00:00:00Z',
      channels: ['whatsapp'],
    }]
    expect(isInDoNotContactWindow(windows, {
      channel: 'whatsapp',
      now: new Date('2026-09-20T12:00:00Z'),
    })).toBe(true)
    expect(isInDoNotContactWindow(windows, {
      channel: 'email',
      now: new Date('2026-09-20T12:00:00Z'),
    })).toBe(false)
    expect(isInDoNotContactWindow(windows, {
      channel: 'whatsapp',
      now: new Date('2026-09-22T12:00:00Z'),
    })).toBe(false)
  })
})

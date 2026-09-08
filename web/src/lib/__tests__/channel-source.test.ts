import { describe, it, expect } from 'vitest'
import {
  deriveChannelFromSourceChannel,
  deriveSourceFromSourceChannel,
  readChannel,
  readSource,
  readSourceChannel,
} from '../channel-source'

describe('deriveChannelFromSourceChannel', () => {
  it('mirrors migration 318 channel lookup', () => {
    expect(deriveChannelFromSourceChannel('whatsapp_bazaar')).toBe('whatsapp')
    expect(deriveChannelFromSourceChannel('instagram_comment')).toBe('instagram_dm')
    expect(deriveChannelFromSourceChannel('x_mention')).toBe('direct')
  })
})

describe('deriveSourceFromSourceChannel', () => {
  it('mirrors migration 318 source lookup', () => {
    expect(deriveSourceFromSourceChannel('email_property_finder')).toBe('property_finder')
    expect(deriveSourceFromSourceChannel('whatsapp')).toBe('direct')
  })
})

describe('dual-read fallback', () => {
  it('prefers channel/source when present', () => {
    expect(readChannel({ channel: 'sms', source_channel: 'whatsapp' })).toBe('sms')
    expect(readSource({ source: 'olx', source_channel: 'whatsapp_bazaar' })).toBe('olx')
  })

  it('derives from source_channel on old payloads', () => {
    const row = { source_channel: 'tiktok_olx' }
    expect(readChannel(row)).toBe('tiktok')
    expect(readSource(row)).toBe('olx')
    expect(readSourceChannel(row)).toBe('tiktok_olx')
  })
})

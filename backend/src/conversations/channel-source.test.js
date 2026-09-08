import { describe, expect, it } from 'vitest'
import {
  conversationChannel,
  conversationMatchesChannel,
  conversationSource,
  deriveChannelFromSourceChannel,
  deriveSourceFromSourceChannel,
  dualWriteChannelSource,
  presentConversation,
} from './channel-source.js'

describe('deriveChannelFromSourceChannel (mirrors migration 318)', () => {
  it.each([
    ['whatsapp', 'whatsapp'],
    ['WhatsApp_Business', 'whatsapp'],
    ['email', 'email'],
    ['sms_twilio', 'sms'],
    ['instagram_dm', 'instagram_dm'],
    ['instagram_comment', 'instagram_dm'],
    ['ig_dm_meta', 'instagram_dm'],
    ['facebook_messenger', 'facebook_messenger'],
    ['fb_page_inbox', 'facebook_messenger'],
    ['tiktok_comment', 'tiktok'],
    ['x_dm', 'x_dm'],
    ['twitter_dm', 'x_dm'],
    ['linkedin', 'linkedin'],
    ['telegram', 'telegram'],
    ['web', 'direct'],
    ['', 'direct'],
    [null, 'direct'],
  ])('%s → %s', (input, expected) => {
    expect(deriveChannelFromSourceChannel(input)).toBe(expected)
  })
})

describe('deriveSourceFromSourceChannel (mirrors migration 318)', () => {
  it.each([
    ['whatsapp_bazaar', 'bazaar'],
    ['email_bayut_lead', 'bayut'],
    ['sms_property_finder', 'property_finder'],
    ['instagram_dubizzle', 'dubizzle'],
    ['web_olx', 'olx'],
    ['whatsapp', 'direct'],
    ['', 'direct'],
  ])('%s → %s', (input, expected) => {
    expect(deriveSourceFromSourceChannel(input)).toBe(expected)
  })
})

describe('dual-read fallback', () => {
  it('prefers typed channel/source when present', () => {
    const row = { source_channel: 'whatsapp_bazaar', channel: 'whatsapp', source: 'bazaar' }
    expect(conversationChannel(row)).toBe('whatsapp')
    expect(conversationSource(row)).toBe('bazaar')
  })

  it('derives from source_channel when typed columns are null', () => {
    const row = { source_channel: 'email_bayut', channel: null, source: null }
    expect(conversationChannel(row)).toBe('email')
    expect(conversationSource(row)).toBe('bayut')
  })

  it('presentConversation always fills channel + source', () => {
    const presented = presentConversation({ id: '1', source_channel: 'sms' })
    expect(presented.channel).toBe('sms')
    expect(presented.source).toBe('direct')
    expect(presented.source_channel).toBe('sms')
  })
})

describe('dual-write', () => {
  it('writes source_channel, channel, and source together', () => {
    expect(dualWriteChannelSource({ channel: 'whatsapp' })).toEqual({
      source_channel: 'whatsapp',
      channel: 'whatsapp',
      source: 'direct',
    })
  })

  it('honours explicit source override', () => {
    expect(dualWriteChannelSource({ channel: 'email', source: 'bazaar' })).toEqual({
      source_channel: 'email',
      channel: 'email',
      source: 'bazaar',
    })
  })

  it('keeps orchestrator transport keys on channel for dispatch', () => {
    expect(dualWriteChannelSource({ channel: 'instagram_comment' }).channel).toBe('instagram_comment')
  })
})

describe('conversationMatchesChannel', () => {
  it('matches legacy source_channel or typed channel', () => {
    expect(conversationMatchesChannel({ source_channel: 'whatsapp' }, 'whatsapp')).toBe(true)
    expect(conversationMatchesChannel({ channel: 'whatsapp', source_channel: null }, 'whatsapp')).toBe(true)
    expect(conversationMatchesChannel({ source_channel: 'email_bayut', channel: null }, 'email')).toBe(true)
    expect(conversationMatchesChannel({ source_channel: 'sms' }, 'whatsapp')).toBe(false)
  })
})

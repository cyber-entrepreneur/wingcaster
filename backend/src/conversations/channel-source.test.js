import { describe, expect, it } from 'vitest'
import {
  conversationChannelSourceFields,
  deriveChannelFromSourceChannel,
  deriveSourceFromSourceChannel,
  matchesConversationChannel,
  readChannel,
  readSource,
  readSourceChannel,
  withChannelSource,
} from './channel-source.js'
import { columnNames } from '../persistence/table-mapper.js'

describe('deriveChannelFromSourceChannel', () => {
  it.each([
    ['whatsapp', 'whatsapp'],
    ['WhatsApp_Bazaar', 'whatsapp'],
    ['email', 'email'],
    ['email_property_finder', 'email'],
    ['sms', 'sms'],
    ['instagram_dm', 'instagram_dm'],
    ['instagram_comment', 'instagram_dm'],
    ['ig_dm_thread', 'instagram_dm'],
    ['facebook_messenger', 'facebook_messenger'],
    ['facebook_comment', 'facebook_messenger'],
    ['fb_page_inbox', 'facebook_messenger'],
    ['tiktok', 'tiktok'],
    ['tiktok_comment', 'tiktok'],
    ['x_dm', 'x_dm'],
    ['twitter_dm', 'x_dm'],
    ['linkedin', 'linkedin'],
    ['linkedin_comment', 'linkedin'],
    ['telegram', 'telegram'],
    ['x_mention', 'direct'],
    ['web', 'direct'],
    [null, 'direct'],
    ['', 'direct'],
  ])('%s → %s', (input, expected) => {
    expect(deriveChannelFromSourceChannel(input)).toBe(expected)
  })
})

describe('deriveSourceFromSourceChannel', () => {
  it.each([
    ['whatsapp', 'direct'],
    ['whatsapp_bazaar', 'bazaar'],
    ['email:bayut', 'bayut'],
    ['sms_property_finder', 'property_finder'],
    ['instagram_dubizzle', 'dubizzle'],
    ['tiktok_olx', 'olx'],
    [null, 'direct'],
  ])('%s → %s', (input, expected) => {
    expect(deriveSourceFromSourceChannel(input)).toBe(expected)
  })
})

describe('dual-read fallback', () => {
  it('prefers channel/source when present', () => {
    const row = { channel: 'whatsapp', source: 'bazaar', source_channel: 'legacy_value' }
    expect(readChannel(row)).toBe('whatsapp')
    expect(readSource(row)).toBe('bazaar')
  })

  it('derives from source_channel when new columns are missing (old rows)', () => {
    const row = { source_channel: 'instagram_comment' }
    expect(readChannel(row)).toBe('instagram_dm')
    expect(readSource(row)).toBe('direct')
    expect(readSourceChannel(row)).toBe('instagram_comment')
  })

  it('derives marketplace source from a packed source_channel', () => {
    const row = { source_channel: 'whatsapp_bayut' }
    expect(readChannel(row)).toBe('whatsapp')
    expect(readSource(row)).toBe('bayut')
  })

  it('composes source_channel from channel+source when compat column is absent', () => {
    expect(readSourceChannel({ channel: 'email', source: 'property_finder' })).toBe('email:property_finder')
    expect(readSourceChannel({ channel: 'sms', source: 'direct' })).toBe('sms')
  })

  it('treats empty strings as absent', () => {
    const row = { channel: '', source: '  ', source_channel: 'sms' }
    expect(readChannel(row)).toBe('sms')
    expect(readSource(row)).toBe('direct')
  })
})

describe('conversationChannelSourceFields dual-write', () => {
  it('writes channel, source, and historical source_channel for a coarse messaging channel', () => {
    expect(conversationChannelSourceFields({ channel: 'whatsapp' })).toEqual({
      channel: 'whatsapp',
      source: 'direct',
      source_channel: 'whatsapp',
    })
  })

  it('keeps a specific messaging channel on source_channel and maps coarse channel', () => {
    expect(conversationChannelSourceFields({ channel: 'instagram_comment' })).toEqual({
      channel: 'instagram_dm',
      source: 'direct',
      source_channel: 'instagram_comment',
    })
  })

  it('packs channel:source onto source_channel when source is not direct', () => {
    expect(conversationChannelSourceFields({ channel: 'whatsapp', source: 'bazaar' })).toEqual({
      channel: 'whatsapp',
      source: 'bazaar',
      source_channel: 'whatsapp:bazaar',
    })
  })

  it('preserves an explicit historical source_channel', () => {
    expect(conversationChannelSourceFields({
      channel: 'email',
      source: 'direct',
      source_channel: 'email',
    })).toEqual({
      channel: 'email',
      source: 'direct',
      source_channel: 'email',
    })
  })
})

describe('matchesConversationChannel', () => {
  it('matches old rows by source_channel', () => {
    expect(matchesConversationChannel({ source_channel: 'instagram_comment' }, 'instagram_comment')).toBe(true)
    expect(matchesConversationChannel({ source_channel: 'instagram_comment' }, 'instagram_dm')).toBe(false)
  })

  it('matches packed source_channel prefixes', () => {
    expect(matchesConversationChannel({ source_channel: 'whatsapp:bazaar' }, 'whatsapp')).toBe(true)
  })

  it('matches new rows that only have channel/source', () => {
    expect(matchesConversationChannel({ channel: 'sms', source: 'direct' }, 'sms')).toBe(true)
    expect(matchesConversationChannel({ channel: 'instagram_dm' }, 'instagram_comment')).toBe(true)
  })
})

describe('withChannelSource', () => {
  it('hydrates all three fields on an old row', () => {
    expect(withChannelSource({ id: 'c1', source_channel: 'email_dubizzle' })).toMatchObject({
      id: 'c1',
      channel: 'email',
      source: 'dubizzle',
      source_channel: 'email_dubizzle',
    })
  })
})

describe('table-mapper conversations columns', () => {
  it('persists channel, source, and source_channel as typed columns', () => {
    const cols = columnNames('conversations')
    expect(cols).toEqual(expect.arrayContaining(['channel', 'source', 'source_channel']))
  })
})

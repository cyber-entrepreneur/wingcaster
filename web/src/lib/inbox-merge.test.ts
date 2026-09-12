import { describe, expect, it } from 'vitest'
import { groupConversationsForInbox } from '@/lib/inbox-merge'
import { collectInboxAttachments } from '@/lib/inbox-media'
import { INBOX_SOURCE_FILTERS } from '@/lib/inbox-labels'

describe('inbox merge grouping', () => {
  it('keeps separate rows by default and groups by contact when merged', () => {
    const rows = [
      {
        id: 'wa',
        contact_id: 'c1',
        contact_name: 'Sara',
        channel: 'whatsapp',
        source: 'bayut',
        last_message_at: '2026-09-08T09:12:00Z',
        last_message_preview: 'Is the 2BR still available?',
        unread_count: 2,
      },
      {
        id: 'ig',
        contact_id: 'c1',
        contact_name: 'Sara',
        channel: 'instagram_dm',
        source: 'direct',
        last_message_at: '2026-09-08T08:00:00Z',
        last_message_preview: 'Saw your story',
        unread_count: 1,
      },
    ]
    const separate = groupConversationsForInbox(rows, 'separate')
    expect(separate).toHaveLength(2)
    const merged = groupConversationsForInbox(rows, 'merged')
    expect(merged).toHaveLength(1)
    expect(merged[0].channels).toEqual(['whatsapp', 'instagram_dm'])
    expect(merged[0].unread_count).toBe(3)
    expect(merged[0].last_message_preview).toMatch(/^WhatsApp:/)
  })
})

describe('inbox media dual-read', () => {
  it('collects image_url, audio_url, and attachments[]', () => {
    const attachments = collectInboxAttachments({
      image_url: 'https://cdn.example/floorplan.jpg',
      audio_url: 'https://cdn.example/note.ogg',
      attachments: [{ url: 'https://cdn.example/offer.pdf', mime: 'application/pdf', filename: 'offer.pdf' }],
    })
    expect(attachments.map((a) => a.kind).sort()).toEqual(['audio', 'image', 'pdf'])
  })
})

describe('source filter catalog', () => {
  it('includes MENA portals already present in SOURCE_LABELS', () => {
    expect(INBOX_SOURCE_FILTERS).toEqual(
      expect.arrayContaining(['aqar', 'wasalt', 'aqarmap', '3akarat']),
    )
  })
})

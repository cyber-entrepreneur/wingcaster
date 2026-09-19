import { describe, expect, it } from 'vitest'
import {
  dayGroupKey,
  filterInboxNotifications,
  groupNotificationsByDay,
} from './inboxHelpers'
import type { InboxNotificationRow } from '@/types/inboxNotifications'

const now = new Date('2026-09-18T12:00:00.000Z')

function row(partial: Partial<InboxNotificationRow> & { id: string }): InboxNotificationRow {
  return {
    title: partial.title || 'Title',
    snippet: partial.snippet || '',
    timestamp: partial.timestamp ?? now.toISOString(),
    unread: partial.unread ?? false,
    category: partial.category,
    href: partial.href,
    ...partial,
  }
}

describe('inboxHelpers', () => {
  it('groups notifications by day', () => {
    const rows = [
      row({ id: '1', timestamp: '2026-09-18T10:00:00.000Z' }),
      row({ id: '2', timestamp: '2026-09-17T10:00:00.000Z' }),
      row({ id: '3', timestamp: '2026-09-10T10:00:00.000Z' }),
    ]
    const groups = groupNotificationsByDay(rows, now)
    expect(groups.map((g) => g.key)).toEqual(['today', 'yesterday', 'earlier'])
  })

  it('filters unread and category', () => {
    const rows = [
      row({ id: '1', unread: true, category: 'leads' }),
      row({ id: '2', unread: false, category: 'billing' }),
    ]
    expect(filterInboxNotifications(rows, { unreadOnly: true }).map((r) => r.id)).toEqual(['1'])
    expect(filterInboxNotifications(rows, { category: 'billing' }).map((r) => r.id)).toEqual(['2'])
  })

  it('classifies day buckets', () => {
    expect(dayGroupKey('2026-09-18T10:00:00.000Z', now)).toBe('today')
    expect(dayGroupKey('2026-09-17T10:00:00.000Z', now)).toBe('yesterday')
    expect(dayGroupKey('2026-09-01T10:00:00.000Z', now)).toBe('earlier')
  })
})

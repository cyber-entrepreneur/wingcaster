import type { InboxNotificationCategory, InboxNotificationRow } from '@/types/inboxNotifications'

export const INBOX_CATEGORY_LABELS: Record<InboxNotificationCategory, string> = {
  leads: 'Leads',
  publications: 'Publications',
  approvals: 'Approvals',
  billing: 'Billing',
  system: 'System',
}

export const INBOX_CATEGORIES: InboxNotificationCategory[] = [
  'leads',
  'publications',
  'approvals',
  'billing',
  'system',
]

const CACHE_KEY = 'wingcaster:inbox-notifications:v1'

export function readInboxCache(): InboxNotificationRow[] {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as InboxNotificationRow[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeInboxCache(rows: InboxNotificationRow[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(rows))
  } catch {
    /* quota / private mode */
  }
}

export function dayGroupKey(timestamp: string | null, now = new Date()): string {
  if (!timestamp) return 'earlier'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'earlier'

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  if (date >= startOfToday) return 'today'
  if (date >= startOfYesterday) return 'yesterday'
  return 'earlier'
}

export const DAY_GROUP_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
}

export function groupNotificationsByDay(
  rows: InboxNotificationRow[],
  now = new Date(),
): Array<{ key: string; label: string; items: InboxNotificationRow[] }> {
  const buckets = new Map<string, InboxNotificationRow[]>()
  for (const row of rows) {
    const key = dayGroupKey(row.timestamp, now)
    const list = buckets.get(key) ?? []
    list.push(row)
    buckets.set(key, list)
  }

  const order = ['today', 'yesterday', 'earlier']
  return order
    .filter((key) => (buckets.get(key)?.length ?? 0) > 0)
    .map((key) => ({
      key,
      label: DAY_GROUP_LABELS[key] ?? key,
      items: buckets.get(key) ?? [],
    }))
}

export function filterInboxNotifications(
  rows: InboxNotificationRow[],
  opts: { unreadOnly?: boolean; category?: InboxNotificationCategory | 'all' },
): InboxNotificationRow[] {
  return rows.filter((row) => {
    if (opts.unreadOnly && !row.unread) return false
    if (opts.category && opts.category !== 'all') {
      const cat = row.category || 'system'
      if (cat !== opts.category) return false
    }
    return true
  })
}

export function formatInboxTimestamp(timestamp: string | null, locale = 'en'): string {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

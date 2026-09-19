export type InboxNotificationCategory =
  | 'leads'
  | 'publications'
  | 'approvals'
  | 'billing'
  | 'system'

export type InboxNotificationRow = {
  id: string
  title: string
  snippet: string
  timestamp: string | null
  unread: boolean
  icon?: string
  category?: InboxNotificationCategory
  href?: string
  type?: string
}

export type InboxNotificationsResponse = {
  notifications: InboxNotificationRow[]
  unreadCount: number
}

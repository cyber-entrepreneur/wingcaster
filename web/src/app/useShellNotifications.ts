import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '@/api/client'
import type { NavNotification } from '@/components/nav/NotificationsPopover'

type NotificationsResponse = {
  notifications?: Array<{
    id: string
    title?: string
    snippet?: string
    timestamp?: string | null
    unread?: boolean
    href?: string
    icon?: string
  }>
  unreadCount?: number
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('fi_token') || localStorage.getItem('sa_token')
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function mapNotification(row: NonNullable<NotificationsResponse['notifications']>[number]): NavNotification {
  return {
    id: String(row.id),
    title: row.title || 'Notification',
    snippet: row.snippet || '',
    timestamp: row.timestamp || new Date().toISOString(),
    unread: row.unread !== false,
    href: row.href,
  }
}

/**
 * Loads GET /api/auth/me/notifications for the top-bar popover.
 * Failures degrade to an empty list (chrome still works offline / before backend).
 */
export function useShellNotifications(enabled = true) {
  const [notifications, setNotifications] = useState<NavNotification[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/me/notifications`, { headers: authHeaders() })
      if (!res.ok) {
        setNotifications([])
        return
      }
      const body = (await res.json()) as NotificationsResponse
      setNotifications((body.notifications ?? []).map(mapNotification))
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
    try {
      await fetch(`${API_BASE}/auth/me/notifications/mark-all-read`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      })
    } catch {
      /* optimistic UI already updated */
    }
  }, [])

  return { notifications, loading, refresh, markAllRead }
}

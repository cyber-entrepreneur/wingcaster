import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'

type ConversationRow = {
  id?: string
  unread_count?: number
  unread?: number | boolean
  is_unread?: boolean
}

/**
 * Inbox unread badge count for agent nav (SHR-NAV-002).
 * No React Query in this app yet — polls via `getConversations` when present.
 */
export function useUnreadConversationCount(options?: {
  enabled?: boolean
  /** Override / seed for tests and Storybook. */
  initialCount?: number
  pollMs?: number
}) {
  const enabled = options?.enabled ?? true
  const pollMs = options?.pollMs ?? 60_000
  const [count, setCount] = useState(options?.initialCount ?? 0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const rows = (await api.getConversations()) as ConversationRow[] | { conversations?: ConversationRow[] }
      const list = Array.isArray(rows) ? rows : (rows.conversations ?? [])
      const next = list.reduce((sum, row) => {
        if (typeof row.unread_count === 'number') return sum + row.unread_count
        if (typeof row.unread === 'number') return sum + row.unread
        if (row.unread === true || row.is_unread === true) return sum + 1
        return sum
      }, 0)
      setCount(next)
    } catch {
      /* keep last known count */
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (options?.initialCount !== undefined) {
      setCount(options.initialCount)
    }
  }, [options?.initialCount])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const id = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(id)
  }, [enabled, pollMs, refresh])

  return { count, loading, refresh }
}

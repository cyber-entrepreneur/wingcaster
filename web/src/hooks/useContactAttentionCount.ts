import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'

type ContactRow = {
  id?: string
  needs_attention?: boolean
  attention?: boolean
  attention_count?: number
  status?: string
}

/**
 * Contacts “attention” badge for agent nav (SHR-NAV-002).
 * Counts contacts flagged as needing attention when the API provides that signal.
 */
export function useContactAttentionCount(options?: {
  enabled?: boolean
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
      const rows = (await api.getContacts()) as ContactRow[] | { contacts?: ContactRow[] }
      const list = Array.isArray(rows) ? rows : (rows.contacts ?? [])
      const next = list.reduce((sum, row) => {
        if (typeof row.attention_count === 'number') return sum + row.attention_count
        if (row.needs_attention || row.attention || row.status === 'needs_attention') return sum + 1
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

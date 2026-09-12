import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type SettingsIndexResponse } from '@/api/client'

const STALE_MS = 5 * 60 * 1000

/**
 * GET /api/settings/index — server-driven settings menu.
 * 5-minute stale-while-revalidate. Never reads `session.role`.
 */
export function useSettingsIndex() {
  const [data, setData] = useState<SettingsIndexResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [revalidating, setRevalidating] = useState(false)
  const hasLoaded = useRef(false)

  const reload = useCallback(async () => {
    if (hasLoaded.current) setRevalidating(true)
    else setLoading(true)
    try {
      const next = await api.getSettingsIndex()
      setData(next)
      setError(null)
      hasLoaded.current = true
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load settings index'))
    } finally {
      setLoading(false)
      setRevalidating(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const id = window.setInterval(() => {
      void reload()
    }, STALE_MS)
    return () => window.clearInterval(id)
  }, [reload])

  return { data, error, loading, revalidating, reload }
}

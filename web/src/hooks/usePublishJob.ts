import { useCallback, useEffect, useRef, useState } from 'react'
import {
  api,
  type PublishingJobPayload,
} from '@/api/client'

const POLL_MS = 60_000

export type UsePublishJobState = {
  data: PublishingJobPayload | null
  loading: boolean
  error: 'not_found' | 'network' | null
  offline: boolean
  refresh: () => Promise<void>
  setData: (payload: PublishingJobPayload | null) => void
}

/**
 * Fetches + polls `GET /api/publishing/jobs/:jobId` every 60s.
 * Revalidates on window focus. Tracks offline via navigator.onLine.
 */
export function usePublishJob(jobId: string | undefined): UsePublishJobState {
  const [data, setData] = useState<PublishingJobPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'not_found' | 'network' | null>(null)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const prevAggregate = useRef<string | null>(null)
  const onAggregateChange = useRef<((from: string | null, to: string) => void) | null>(null)

  const fetchJob = useCallback(async (opts?: { silent?: boolean }) => {
    if (!jobId) {
      setLoading(false)
      setError('not_found')
      return
    }
    if (!opts?.silent) setLoading(true)
    try {
      const payload = await api.getPublishingJob(jobId)
      const nextAgg = payload.job.aggregate
      if (
        prevAggregate.current &&
        prevAggregate.current !== nextAgg &&
        onAggregateChange.current
      ) {
        onAggregateChange.current(prevAggregate.current, nextAgg)
      }
      prevAggregate.current = nextAgg
      setData(payload)
      setError(null)
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 404) {
        setError('not_found')
        setData(null)
      } else {
        setError('network')
      }
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    void fetchJob()
  }, [fetchJob])

  useEffect(() => {
    if (!jobId) return
    const id = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      void fetchJob({ silent: true })
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [jobId, fetchJob])

  useEffect(() => {
    const onFocus = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      void fetchJob({ silent: true })
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchJob])

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => {
      setOffline(false)
      void fetchJob({ silent: true })
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [fetchJob])

  return {
    data,
    loading,
    error,
    offline,
    refresh: () => fetchJob(),
    setData,
  }
}

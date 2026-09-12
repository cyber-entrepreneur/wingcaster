import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import type {
  ApplicationOutcomeActionResult,
  ApplicationOutcomePayload,
} from '@/pages/agent/applicationOutcomeTypes'

const POLL_MS = 60_000

export type OutcomeFetchState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ApplicationOutcomePayload }

/**
 * Fetches AGT-REC-004 outcome payload, polls every 60s, and revalidates on focus.
 */
export function useAgencyApplicationOutcome(applicationId: string | undefined) {
  const [state, setState] = useState<OutcomeFetchState>({ status: 'loading' })
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const prevStatusRef = useRef<string | null>(null)
  const [statusChangedTo, setStatusChangedTo] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!applicationId) {
      setState({ status: 'not_found' })
      return
    }
    if (!opts?.silent) setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }))
    try {
      const data = (await api.getMyAgencyApplicationOutcome(
        applicationId,
      )) as ApplicationOutcomePayload
      const nextStatus = data.application.status
      if (prevStatusRef.current && prevStatusRef.current !== nextStatus) {
        setStatusChangedTo(nextStatus)
      }
      prevStatusRef.current = nextStatus
      setState({ status: 'ready', data })
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 404) {
        setState({ status: 'not_found' })
        return
      }
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Request failed',
      })
    }
  }, [applicationId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!applicationId) return
    const id = window.setInterval(() => {
      void load({ silent: true })
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [applicationId, load])

  useEffect(() => {
    const onFocus = () => {
      void load({ silent: true })
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => {
      setOffline(false)
      void load({ silent: true })
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [load])

  const accept = useCallback(async () => {
    if (!applicationId) throw new Error('Missing application id')
    return (await api.acceptMyAgencyApplication(
      applicationId,
    )) as ApplicationOutcomeActionResult
  }, [applicationId])

  const decline = useCallback(async () => {
    if (!applicationId) throw new Error('Missing application id')
    const result = (await api.declineMyAgencyApplication(
      applicationId,
    )) as ApplicationOutcomeActionResult
    await load({ silent: true })
    return result
  }, [applicationId, load])

  const withdraw = useCallback(async () => {
    if (!applicationId) throw new Error('Missing application id')
    const result = (await api.withdrawMyAgencyApplication(
      applicationId,
    )) as ApplicationOutcomeActionResult
    await load({ silent: true })
    return result
  }, [applicationId, load])

  const clearStatusChange = useCallback(() => setStatusChangedTo(null), [])

  return {
    state,
    offline,
    statusChangedTo,
    clearStatusChange,
    reload: load,
    accept,
    decline,
    withdraw,
  }
}

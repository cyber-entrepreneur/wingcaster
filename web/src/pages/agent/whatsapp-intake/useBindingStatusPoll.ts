import { useCallback, useEffect, useRef, useState } from 'react'
import { getBindingStatus, type BindingStatusPayload } from './intakeApi'

export interface UseBindingStatusPollOptions {
  enabled?: boolean
  intervalMs?: number
  backoffAfterMs?: number
  backoffIntervalMs?: number
  capMs?: number
  errorThreshold?: number
  errorIntervalMs?: number
}

export interface UseBindingStatusPollResult {
  status: BindingStatusPayload | null
  bound: boolean
  pollError: boolean
  capReached: boolean
  consecutiveFailures: number
}

const DEFAULTS = {
  intervalMs: 3000,
  backoffAfterMs: 60_000,
  backoffIntervalMs: 10_000,
  capMs: 24 * 60 * 60 * 1000,
  errorThreshold: 3,
  errorIntervalMs: 30_000,
}

/**
 * Binding-status poll with backoff, 24h cap, and Visibility API pause.
 * Cancels on unmount.
 */
export function useBindingStatusPoll(
  options: UseBindingStatusPollOptions = {},
): UseBindingStatusPollResult {
  const enabled = options.enabled ?? true
  const intervalMs = options.intervalMs ?? DEFAULTS.intervalMs
  const backoffAfterMs = options.backoffAfterMs ?? DEFAULTS.backoffAfterMs
  const backoffIntervalMs = options.backoffIntervalMs ?? DEFAULTS.backoffIntervalMs
  const capMs = options.capMs ?? DEFAULTS.capMs
  const errorThreshold = options.errorThreshold ?? DEFAULTS.errorThreshold
  const errorIntervalMs = options.errorIntervalMs ?? DEFAULTS.errorIntervalMs

  const [status, setStatus] = useState<BindingStatusPayload | null>(null)
  const [pollError, setPollError] = useState(false)
  const [capReached, setCapReached] = useState(false)
  const [failures, setFailures] = useState(0)

  const startedAt = useRef(Date.now())
  const timer = useRef<number | null>(null)
  const inFlight = useRef(false)
  const failuresRef = useRef(0)

  const clearTimer = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const tick = useCallback(async () => {
    if (!enabled || inFlight.current) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return

    const elapsed = Date.now() - startedAt.current
    if (elapsed >= capMs) {
      setCapReached(true)
      clearTimer()
      return
    }

    inFlight.current = true
    const result = await getBindingStatus()
    inFlight.current = false

    if (result.ok && result.data) {
      failuresRef.current = 0
      setFailures(0)
      setStatus(result.data)
      setPollError(false)
      if (result.data.bound) {
        clearTimer()
        return
      }
    } else {
      failuresRef.current += 1
      setFailures(failuresRef.current)
      if (failuresRef.current >= errorThreshold) setPollError(true)
    }

    const nextDelay = (() => {
      if (failuresRef.current >= errorThreshold) return errorIntervalMs
      if (elapsed >= backoffAfterMs) return backoffIntervalMs
      return intervalMs
    })()

    clearTimer()
    timer.current = window.setTimeout(() => {
      void tick()
    }, nextDelay)
  }, [enabled, intervalMs, backoffAfterMs, backoffIntervalMs, capMs, errorThreshold, errorIntervalMs])

  useEffect(() => {
    if (!enabled) return
    startedAt.current = Date.now()
    failuresRef.current = 0
    setCapReached(false)
    void tick()

    const onVis = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    const onOnline = () => void tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    return () => {
      clearTimer()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onOnline)
    }
  }, [enabled, tick])

  return {
    status,
    bound: Boolean(status?.bound),
    pollError,
    capReached,
    consecutiveFailures: failures,
  }
}

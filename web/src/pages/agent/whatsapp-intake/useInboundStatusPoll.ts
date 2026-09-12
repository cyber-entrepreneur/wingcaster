import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getInboundStatus,
  listBindings,
  type InboundStatusPayload,
} from './intakeApi'

export interface UseInboundStatusPollOptions {
  enabled?: boolean
  bindingId?: string | null
  intervalMs?: number
  backoffAfterMs?: number
  backoffIntervalMs?: number
  lateBackoffAfterMs?: number
  lateBackoffIntervalMs?: number
  capMs?: number
  errorThreshold?: number
  errorIntervalMs?: number
}

export interface UseInboundStatusPollResult {
  inbound: InboundStatusPayload | null
  bindingId: string | null
  pollError: boolean
  capReached: boolean
  bindingLost: boolean
}

const DEFAULTS = {
  intervalMs: 2000,
  backoffAfterMs: 30_000,
  backoffIntervalMs: 5000,
  lateBackoffAfterMs: 90_000,
  lateBackoffIntervalMs: 10_000,
  capMs: 24 * 60 * 60 * 1000,
  errorThreshold: 3,
  errorIntervalMs: 15_000,
}

/**
 * BE-BLOCKER-14 poll: GET /api/intake/inbound-status/:bindingId
 * Backoff 2s → 5s after 30s → 10s after 90s. Cap 24h. Pause when hidden.
 */
export function useInboundStatusPoll(
  options: UseInboundStatusPollOptions = {},
): UseInboundStatusPollResult {
  const enabled = options.enabled ?? true
  const intervalMs = options.intervalMs ?? DEFAULTS.intervalMs
  const backoffAfterMs = options.backoffAfterMs ?? DEFAULTS.backoffAfterMs
  const backoffIntervalMs = options.backoffIntervalMs ?? DEFAULTS.backoffIntervalMs
  const lateBackoffAfterMs = options.lateBackoffAfterMs ?? DEFAULTS.lateBackoffAfterMs
  const lateBackoffIntervalMs = options.lateBackoffIntervalMs ?? DEFAULTS.lateBackoffIntervalMs
  const capMs = options.capMs ?? DEFAULTS.capMs
  const errorThreshold = options.errorThreshold ?? DEFAULTS.errorThreshold
  const errorIntervalMs = options.errorIntervalMs ?? DEFAULTS.errorIntervalMs

  const [inbound, setInbound] = useState<InboundStatusPayload | null>(null)
  const [resolvedBindingId, setResolvedBindingId] = useState<string | null>(options.bindingId ?? null)
  const [pollError, setPollError] = useState(false)
  const [capReached, setCapReached] = useState(false)
  const [bindingLost, setBindingLost] = useState(false)

  const startedAt = useRef(Date.now())
  const timer = useRef<number | null>(null)
  const inFlight = useRef(false)
  const failuresRef = useRef(0)
  const bindingIdRef = useRef(options.bindingId ?? null)

  useEffect(() => {
    bindingIdRef.current = options.bindingId ?? resolvedBindingId
  }, [options.bindingId, resolvedBindingId])

  const clearTimer = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const resolveBindingId = useCallback(async (): Promise<string | null> => {
    if (bindingIdRef.current) return bindingIdRef.current
    const list = await listBindings()
    const id = list.ok && Array.isArray(list.data) && list.data[0]?.id ? list.data[0].id : null
    if (id) {
      bindingIdRef.current = id
      setResolvedBindingId(id)
    }
    return id
  }, [])

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
    const bindingId = await resolveBindingId()
    if (!bindingId) {
      inFlight.current = false
      failuresRef.current += 1
      if (failuresRef.current >= errorThreshold) setPollError(true)
    } else {
      const result = await getInboundStatus(bindingId)
      inFlight.current = false
      if (result.ok && result.data) {
        failuresRef.current = 0
        setInbound(result.data)
        setPollError(false)
        if (result.data.bound === false) {
          setBindingLost(true)
          clearTimer()
          return
        }
        if (result.data.latest_message_at) {
          clearTimer()
          return
        }
      } else {
        failuresRef.current += 1
        if (failuresRef.current >= errorThreshold) setPollError(true)
      }
    }

    const nextDelay = (() => {
      if (failuresRef.current >= errorThreshold) return errorIntervalMs
      if (elapsed >= lateBackoffAfterMs) return lateBackoffIntervalMs
      if (elapsed >= backoffAfterMs) return backoffIntervalMs
      return intervalMs
    })()

    clearTimer()
    timer.current = window.setTimeout(() => {
      void tick()
    }, nextDelay)
  }, [
    enabled,
    intervalMs,
    backoffAfterMs,
    backoffIntervalMs,
    lateBackoffAfterMs,
    lateBackoffIntervalMs,
    capMs,
    errorThreshold,
    errorIntervalMs,
    resolveBindingId,
  ])

  useEffect(() => {
    if (!enabled) return
    startedAt.current = Date.now()
    failuresRef.current = 0
    setCapReached(false)
    setBindingLost(false)
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
    inbound,
    bindingId: resolvedBindingId,
    pollError,
    capReached,
    bindingLost,
  }
}

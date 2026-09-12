import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DraftField, DraftFieldKey, LiveDraftConnectionMode } from '@/components/onboarding/whatsapp'
import {
  draftProgressSseUrl,
  getDraftState,
  getProgressCapability,
  headDraftProgress,
  type DraftFieldSnapshot,
  type DraftStateSnapshot,
} from './intakeApi'
import { FIELD_LABELS } from './tour'

const FIELD_KEYS: DraftFieldKey[] = [
  'address',
  'bedrooms',
  'bathrooms',
  'price',
  'area_sqft',
  'description',
  'photos',
]

export function idleFields(): DraftField[] {
  return FIELD_KEYS.map((key) => ({
    key,
    label: FIELD_LABELS[key],
    state: 'idle' as const,
  }))
}

function snapshotToFields(snapshot: DraftStateSnapshot | null | undefined): DraftField[] {
  const byKey = new Map<string, DraftFieldSnapshot>()
  for (const field of snapshot?.fields ?? []) {
    byKey.set(field.key, field)
  }
  return FIELD_KEYS.map((key) => {
    const src = byKey.get(key)
    return {
      key,
      label: src?.label || FIELD_LABELS[key],
      state: src?.state ?? 'idle',
      value: src?.value,
      streamedText: src?.streamedText,
    }
  })
}

function canvasConnection(mode: 'sse' | 'polling' | 'fallback'): LiveDraftConnectionMode {
  if (mode === 'polling') return 'polling'
  if (mode === 'fallback') return 'fallback'
  return 'sse'
}

export interface UseDraftProgressResult {
  fields: DraftField[]
  connection: LiveDraftConnectionMode
  transport: 'sse' | 'polling' | 'fallback'
  isReady: boolean
  isConnecting: boolean
  error: string | null
  draftId: string | null
  completedCount: number
  totalCount: number
}

type ProgressEvent = {
  type?: string
  field?: string
  value?: unknown
  partial_text?: string
  message?: string
  draft_id?: string | null
  session_id?: string
}

/**
 * Abstracts SSE → polling → determinate-spinner fallback.
 * Feature-detects via HEAD + capability + EventSource error.
 * NEVER invents field streaming on a client timer.
 */
export function useDraftProgress(sessionId: string | undefined): UseDraftProgressResult {
  const [fields, setFields] = useState<DraftField[]>(() => idleFields())
  const [transport, setTransport] = useState<'sse' | 'polling' | 'fallback'>('sse')
  const [isReady, setIsReady] = useState(false)
  const [isConnecting, setIsConnecting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)

  const esRef = useRef<EventSource | null>(null)
  const pollTimer = useRef<number | null>(null)
  const pollFails = useRef(0)
  const stopped = useRef(false)
  const sessionRef = useRef(sessionId)

  sessionRef.current = sessionId

  const applySnapshot = useCallback((snapshot: DraftStateSnapshot) => {
    setFields(snapshotToFields(snapshot))
    if (snapshot.draft_id) setDraftId(snapshot.draft_id)
    if (snapshot.error) setError(snapshot.error)
    if (snapshot.draft_ready) {
      setIsReady(true)
      setIsConnecting(false)
    }
  }, [])

  const stopAll = useCallback(() => {
    stopped.current = true
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    if (pollTimer.current != null) {
      window.clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  const startPolling = useCallback(
    (interval: number) => {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
      setTransport('polling')
      setIsConnecting(false)
      pollFails.current = 0

      const loop = async () => {
        if (stopped.current) return
        const id = sessionRef.current
        if (!id) return
        const result = await getDraftState(id)
        if (stopped.current) return
        if (result.ok && result.data) {
          pollFails.current = 0
          applySnapshot(result.data)
          if (result.data.draft_ready) return
          if (result.data.error) {
            setError(result.data.error)
            return
          }
        } else {
          pollFails.current += 1
          if (pollFails.current >= 3) {
            setTransport('fallback')
          }
        }
        pollTimer.current = window.setTimeout(() => {
          void loop()
        }, interval)
      }

      void loop()
    },
    [applySnapshot],
  )

  const startFallback = useCallback(
    (interval: number) => {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
      setTransport('fallback')
      setIsConnecting(false)
      // Still poll for real completion — do not fake field streaming.
      const loop = async () => {
        if (stopped.current) return
        const id = sessionRef.current
        if (!id) return
        const result = await getDraftState(id)
        if (stopped.current) return
        if (result.ok && result.data) {
          if (result.data.draft_id) setDraftId(result.data.draft_id)
          if (result.data.error) {
            setError(result.data.error)
            applySnapshot(result.data)
            return
          }
          if (result.data.draft_ready) {
            applySnapshot(result.data)
            return
          }
        }
        pollTimer.current = window.setTimeout(() => {
          void loop()
        }, interval)
      }
      void loop()
    },
    [applySnapshot],
  )

  const applySseEvent = useCallback((event: ProgressEvent) => {
    const type = event.type
    if (type === 'error') {
      setError(event.message || 'Draft processing failed')
      return
    }
    if (type === 'draft_ready') {
      if (event.draft_id) setDraftId(event.draft_id)
      setIsReady(true)
      setIsConnecting(false)
      setFields((prev) =>
        prev.map((f) => (f.state === 'complete' ? f : { ...f, state: 'complete' as const })),
      )
      return
    }
    const key = event.field as DraftFieldKey | undefined
    if (!key || !FIELD_KEYS.includes(key)) return

    setFields((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f
        if (type === 'field_start') {
          return { ...f, state: 'thinking' }
        }
        if (type === 'field_stream') {
          return {
            ...f,
            state: 'streaming',
            streamedText: event.partial_text ?? f.streamedText,
          }
        }
        if (type === 'field_complete') {
          return {
            ...f,
            state: 'complete',
            value: event.value as DraftField['value'],
            streamedText:
              key === 'description' && typeof event.value === 'string' ? event.value : f.streamedText,
          }
        }
        return f
      }),
    )
    setIsConnecting(false)
  }, [])

  const startSse = useCallback(
    (id: string, interval: number) => {
      if (typeof EventSource === 'undefined') {
        startPolling(interval)
        return
      }
      setTransport('sse')
      const url = draftProgressSseUrl(id)
      const es = new EventSource(url)
      esRef.current = es

      const handle = (raw: MessageEvent) => {
        let parsed: ProgressEvent = {}
        try {
          parsed = JSON.parse(raw.data) as ProgressEvent
        } catch {
          return
        }
        if (!parsed.type && raw.type && raw.type !== 'message') {
          parsed.type = raw.type
        }
        applySseEvent(parsed)
      }

      const named = ['field_start', 'field_complete', 'field_stream', 'draft_ready', 'error']
      for (const name of named) {
        es.addEventListener(name, handle as EventListener)
      }
      es.onmessage = handle
      es.onerror = () => {
        es.close()
        esRef.current = null
        void (async () => {
          const sid = sessionRef.current
          if (!sid || stopped.current) return
          const probe = await getDraftState(sid)
          if (stopped.current) return
          if (probe.ok && probe.data) {
            applySnapshot(probe.data)
            if (!probe.data.draft_ready) startPolling(interval)
            return
          }
          startFallback(interval)
        })()
      }
    },
    [applySseEvent, applySnapshot, startFallback, startPolling],
  )

  useEffect(() => {
    stopped.current = false
    setFields(idleFields())
    setIsReady(false)
    setError(null)
    setDraftId(null)
    setIsConnecting(true)
    pollFails.current = 0

    if (!sessionId) {
      setIsConnecting(false)
      return
    }

    let cancelled = false

    const boot = async () => {
      const cap = await getProgressCapability()
      const advertisedInterval = cap.data?.poll_interval_ms || 3000

      const head = await headDraftProgress(sessionId)
      if (cancelled || stopped.current) return

      const sseAdvertised =
        (cap.ok && cap.data?.sse === true && cap.data?.mode !== 'poll') || head.sse

      if (sseAdvertised && head.status !== 404 && typeof EventSource !== 'undefined') {
        startSse(sessionId, head.pollIntervalMs || advertisedInterval)
        setIsConnecting(false)
        return
      }

      // Probe poll once before committing to polling vs spinner fallback.
      const probe = await getDraftState(sessionId)
      if (cancelled || stopped.current) return
      if (probe.ok && probe.data) {
        applySnapshot(probe.data)
        if (probe.data.draft_ready) {
          setTransport('polling')
          setIsConnecting(false)
          return
        }
        startPolling(head.pollIntervalMs || advertisedInterval)
        return
      }

      startFallback(head.pollIntervalMs || advertisedInterval)
    }

    void boot()

    return () => {
      cancelled = true
      stopAll()
    }
  }, [sessionId, applySnapshot, startFallback, startPolling, startSse, stopAll])

  const completedCount = useMemo(
    () => fields.filter((f) => f.state === 'complete').length,
    [fields],
  )

  return {
    fields,
    connection: canvasConnection(transport),
    transport,
    isReady,
    isConnecting,
    error,
    draftId,
    completedCount,
    totalCount: FIELD_KEYS.length,
  }
}

export { FIELD_KEYS }

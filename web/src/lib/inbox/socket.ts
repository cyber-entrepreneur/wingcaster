import { useEffect, useRef } from 'react'
import { API_BASE, getAuthToken } from '@/api/client'

function readAuthToken(): string {
  try {
    const fromApi = getAuthToken()
    if (fromApi) return String(fromApi)
  } catch {
    // api mock suites may omit getAuthToken — fall through
  }
  try {
    if (typeof localStorage === 'undefined') return ''
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('auth_token') ||
      ''
    )
  } catch {
    return ''
  }
}

export type InboxSocketEvent = {
  type: string
  conversation_id?: string
  message_id?: string
  payload?: unknown
}

export type InboxSocketStatus = 'connecting' | 'open' | 'reconnecting' | 'fallback' | 'closed'

export type ConnectInboxSocketOptions = {
  onEvent: (event: InboxSocketEvent) => void
  onStatus?: (status: InboxSocketStatus) => void
  /** Called only after reconnect attempts are exhausted (slow-poll fallback). */
  onFallbackPoll?: () => void
  /** Failures before entering slow-poll mode. */
  maxReconnectFailures?: number
  fallbackPollMs?: number
}

const BACKOFF_MS = [1000, 2000, 4000, 8000] as const
const BACKOFF_CAP_MS = 30_000

function resolveWsUrl(token: string): string | null {
  if (typeof window === 'undefined') return null
  const configured = String(API_BASE || '').trim()
  let httpBase = configured
  if (!httpBase || httpBase.startsWith('/')) {
    httpBase = window.location.origin
  }
  try {
    const url = new URL(httpBase)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/ws/inbox'
    url.search = `token=${encodeURIComponent(token)}`
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function nextBackoff(attempt: number): number {
  if (attempt < BACKOFF_MS.length) return BACKOFF_MS[attempt]
  return BACKOFF_CAP_MS
}

export type InboxSocketHandle = {
  close: () => void
}

/**
 * Connect to `/ws/inbox` with reconnect backoff.
 * Slow-poll (30s) starts ONLY after reconnect failures are exhausted —
 * never alongside a healthy socket.
 */
export function connectInboxSocket(options: ConnectInboxSocketOptions): InboxSocketHandle {
  const {
    onEvent,
    onStatus,
    onFallbackPoll,
    maxReconnectFailures = 6,
    fallbackPollMs = 30_000,
  } = options

  let closed = false
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let failures = 0
  let fallbackActive = false

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const clearPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    fallbackActive = false
  }

  const startFallbackPoll = () => {
    if (closed || fallbackActive || !onFallbackPoll) return
    fallbackActive = true
    onStatus?.('fallback')
    onFallbackPoll()
    pollTimer = setInterval(() => {
      if (closed || !navigator.onLine) return
      onFallbackPoll()
    }, fallbackPollMs)
  }

  const connect = () => {
    if (closed) return
    const token = readAuthToken()
    if (!token) {
      failures += 1
      if (failures >= maxReconnectFailures) {
        startFallbackPoll()
        return
      }
      onStatus?.('reconnecting')
      reconnectTimer = setTimeout(connect, nextBackoff(failures - 1))
      return
    }

    const wsUrl = resolveWsUrl(token)
    if (!wsUrl) {
      failures += 1
      if (failures >= maxReconnectFailures) {
        startFallbackPoll()
        return
      }
      onStatus?.('reconnecting')
      reconnectTimer = setTimeout(connect, nextBackoff(failures - 1))
      return
    }

    onStatus?.(failures > 0 ? 'reconnecting' : 'connecting')
    try {
      socket = new WebSocket(wsUrl)
    } catch {
      failures += 1
      if (failures >= maxReconnectFailures) {
        startFallbackPoll()
        return
      }
      reconnectTimer = setTimeout(connect, nextBackoff(failures - 1))
      return
    }

    socket.onopen = () => {
      failures = 0
      clearPoll()
      onStatus?.('open')
    }

    socket.onmessage = (message) => {
      try {
        const parsed = JSON.parse(String(message.data || '{}')) as InboxSocketEvent
        if (parsed?.type) onEvent(parsed)
      } catch {
        // ignore malformed frames
      }
    }

    socket.onclose = () => {
      if (closed) return
      failures += 1
      if (failures >= maxReconnectFailures) {
        startFallbackPoll()
        return
      }
      onStatus?.('reconnecting')
      clearReconnect()
      reconnectTimer = setTimeout(connect, nextBackoff(failures - 1))
    }

    socket.onerror = () => {
      try {
        socket?.close()
      } catch {
        // ignore
      }
    }
  }

  connect()

  return {
    close: () => {
      closed = true
      clearReconnect()
      clearPoll()
      onStatus?.('closed')
      try {
        socket?.close()
      } catch {
        // ignore
      }
      socket = null
    },
  }
}

export function useInboxSocket(options: {
  enabled?: boolean
  onEvent: (event: InboxSocketEvent) => void
  onStatus?: (status: InboxSocketStatus) => void
  onFallbackPoll?: () => void
}) {
  const { enabled = true, onEvent, onStatus, onFallbackPoll } = options
  const onEventRef = useRef(onEvent)
  const onStatusRef = useRef(onStatus)
  const onFallbackRef = useRef(onFallbackPoll)
  onEventRef.current = onEvent
  onStatusRef.current = onStatus
  onFallbackRef.current = onFallbackPoll

  useEffect(() => {
    if (!enabled) return
    const handle = connectInboxSocket({
      onEvent: (event) => onEventRef.current(event),
      onStatus: (status) => onStatusRef.current?.(status),
      onFallbackPoll: () => onFallbackRef.current?.(),
    })
    return () => handle.close()
  }, [enabled])
}

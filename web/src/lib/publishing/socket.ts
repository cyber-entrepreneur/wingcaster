import { API_BASE, getAuthToken } from '@/api/client'
import type { PortalSubmissionPushEvent } from '@/hooks/publishing/types'

export type PublishingSocketStatus =
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'fallback'
  | 'closed'

export type ConnectPublishingSocketOptions = {
  onEvent: (event: PortalSubmissionPushEvent) => void
  onStatus?: (status: PublishingSocketStatus) => void
  /** Called only after reconnect attempts are exhausted (slow-poll fallback). */
  onFallbackPoll?: () => void
  maxReconnectFailures?: number
  fallbackPollMs?: number
}

const BACKOFF_MS = [1000, 2000, 4000, 8000] as const
const BACKOFF_CAP_MS = 30_000

function readAuthToken(): string {
  try {
    const fromApi = getAuthToken()
    if (fromApi) return String(fromApi)
  } catch {
    // api mock suites may omit getAuthToken
  }
  try {
    if (typeof localStorage === 'undefined') return ''
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('fi_token') ||
      localStorage.getItem('sa_token') ||
      ''
    )
  } catch {
    return ''
  }
}

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
    url.pathname = '/ws/publishing'
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

export type PublishingSocketHandle = {
  close: () => void
}

/**
 * Connect to `/ws/publishing` with reconnect backoff.
 * Slow-poll starts ONLY after reconnect failures are exhausted.
 */
export function connectPublishingSocket(
  options: ConnectPublishingSocketOptions,
): PublishingSocketHandle {
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
    const wsUrl = resolveWsUrl(token)
    if (!wsUrl) {
      startFallbackPoll()
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

    socket.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as PortalSubmissionPushEvent
        onEvent(parsed)
      } catch {
        // ignore malformed
      }
    }

    socket.onclose = () => {
      socket = null
      if (closed) {
        onStatus?.('closed')
        return
      }
      failures += 1
      if (failures >= maxReconnectFailures) {
        startFallbackPoll()
        return
      }
      onStatus?.('reconnecting')
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
      try {
        socket?.close()
      } catch {
        // ignore
      }
      socket = null
      onStatus?.('closed')
    },
  }
}

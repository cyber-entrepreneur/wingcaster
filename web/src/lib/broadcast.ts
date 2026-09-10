/**
 * Thin BroadcastChannel wrapper for cross-tab WingCaster session sync.
 * Channel: `wingcaster-session`
 * Events: tenant-switched | locale-changed | env-changed | signed-out
 */

export type SessionBroadcastEvent =
  | { type: 'tenant-switched'; tenantId: string }
  | { type: 'locale-changed'; locale: 'en' | 'ar' }
  | { type: 'env-changed'; env: 'live' | 'test' }
  | { type: 'signed-out' }

export const SESSION_BROADCAST_CHANNEL = 'wingcaster-session'

type SessionBroadcastListener = (event: SessionBroadcastEvent) => void

function canUseBroadcastChannel(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.BroadcastChannel === 'function'
}

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (!canUseBroadcastChannel()) return null
  if (!channel) {
    channel = new globalThis.BroadcastChannel(SESSION_BROADCAST_CHANNEL)
  }
  return channel
}

export function publishSessionEvent(event: SessionBroadcastEvent): void {
  const ch = getChannel()
  if (!ch) return
  ch.postMessage(event)
}

export function subscribeSessionEvents(listener: SessionBroadcastListener): () => void {
  const ch = getChannel()
  if (!ch) return () => {}

  const handler = (messageEvent: MessageEvent<SessionBroadcastEvent>) => {
    const data = messageEvent.data
    if (!data || typeof data !== 'object' || !('type' in data)) return
    listener(data)
  }

  ch.addEventListener('message', handler)
  return () => {
    ch.removeEventListener('message', handler)
  }
}

/** Test-only: drop the cached channel so the next call rebuilds against the current stub. */
export function __resetSessionBroadcastForTests(): void {
  try {
    channel?.close()
  } catch {
    /* ignore */
  }
  channel = null
}

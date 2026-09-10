import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('broadcast session channel', () => {
  let listeners: Set<(event: MessageEvent) => void>
  let MockBroadcastChannel: typeof BroadcastChannel

  beforeEach(() => {
    listeners = new Set()
    MockBroadcastChannel = class {
      name: string
      constructor(name: string) {
        this.name = name
      }
      postMessage(data: unknown) {
        const event = { data } as MessageEvent
        for (const listener of listeners) listener(event)
      }
      addEventListener(_type: string, listener: EventListener) {
        listeners.add(listener as (event: MessageEvent) => void)
      }
      removeEventListener(_type: string, listener: EventListener) {
        listeners.delete(listener as (event: MessageEvent) => void)
      }
      close() {
        listeners.clear()
      }
    } as unknown as typeof BroadcastChannel

    vi.resetModules()
    globalThis.BroadcastChannel = MockBroadcastChannel
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('publishes and receives tenant-switched events on wingcaster-session', async () => {
    const { publishSessionEvent, subscribeSessionEvents, SESSION_BROADCAST_CHANNEL } =
      await import('../broadcast')

    expect(SESSION_BROADCAST_CHANNEL).toBe('wingcaster-session')

    const received: unknown[] = []
    const unsubscribe = subscribeSessionEvents((event) => {
      received.push(event)
    })

    publishSessionEvent({ type: 'tenant-switched', tenantId: 'tenant-1' })
    publishSessionEvent({ type: 'locale-changed', locale: 'ar' })
    publishSessionEvent({ type: 'env-changed', env: 'test' })
    publishSessionEvent({ type: 'signed-out' })

    expect(received).toEqual([
      { type: 'tenant-switched', tenantId: 'tenant-1' },
      { type: 'locale-changed', locale: 'ar' },
      { type: 'env-changed', env: 'test' },
      { type: 'signed-out' },
    ])

    unsubscribe()
  })
})

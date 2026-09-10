﻿// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'


describe('broadcast session channel', () => {
  let listeners: Set<(event: MessageEvent) => void>

  beforeEach(() => {
    listeners = new Set()



    class MockBroadcastChannel {
      name: string
      constructor(name: string) {
        this.name = name
      }
      postMessage(data: unknown) {
        const event = { data } as MessageEvent
        // Same-tab delivery for unit tests (real BC is cross-context only).
        for (const listener of [...listeners]) listener(event)
      }
      addEventListener(type: string, listener: EventListener) {
        if (type === 'message') listeners.add(listener as (event: MessageEvent) => void)
      }
      removeEventListener(type: string, listener: EventListener) {
        if (type === 'message') listeners.delete(listener as (event: MessageEvent) => void)
      }
      close() {
        listeners.clear()
      }
    }

    vi.resetModules()
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    // jsdom: ensure window sees the same constructor used by canUseBroadcastChannel()
    ;(window as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel =
      MockBroadcastChannel as unknown as typeof BroadcastChannel


  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()

    vi.resetModules()

  })

  it('publishes and receives tenant-switched events on wingcaster-session', async () => {
    const mod = await import('../broadcast')
    mod.__resetSessionBroadcastForTests()

    expect(mod.SESSION_BROADCAST_CHANNEL).toBe('wingcaster-session')

    const received: unknown[] = []
    const unsubscribe = mod.subscribeSessionEvents((event) => {
      received.push(event)
    })

    mod.publishSessionEvent({ type: 'tenant-switched', tenantId: 'tenant-1' })
    mod.publishSessionEvent({ type: 'locale-changed', locale: 'ar' })
    mod.publishSessionEvent({ type: 'env-changed', env: 'test' })
    mod.publishSessionEvent({ type: 'signed-out' })

    expect(received).toEqual([
      { type: 'tenant-switched', tenantId: 'tenant-1' },
      { type: 'locale-changed', locale: 'ar' },
      { type: 'env-changed', env: 'test' },
      { type: 'signed-out' },
    ])

    unsubscribe()
  })
})

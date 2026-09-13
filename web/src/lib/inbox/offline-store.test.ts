import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetOfflineStoreForTests,
  enqueueOutgoing,
  flushOutbox,
  getConversation,
  getConversationList,
  getMessages,
  openInboxDbAtVersion,
  saveConversation,
  saveConversationList,
  saveMessages,
} from './offline-store'

describe('inbox offline-store', () => {
  beforeEach(async () => {
    await __resetOfflineStoreForTests()
  })

  afterEach(async () => {
    await __resetOfflineStoreForTests()
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('wc-inbox-v1')
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve()
    })
  })

  it('saves and reads conversations and messages', async () => {
    await saveConversation({ id: 'c1', contact_name: 'Sara' })
    await saveMessages([
      { id: 'm1', conversation_id: 'c1', content: 'hello', created_at: '2026-01-01T00:00:00Z' },
      { id: 'm2', conversation_id: 'c1', content: 'world', created_at: '2026-01-01T00:01:00Z' },
      { id: 'm3', conversation_id: 'c2', content: 'other', created_at: '2026-01-01T00:02:00Z' },
    ])

    const conversation = await getConversation('c1')
    expect(conversation?.contact_name).toBe('Sara')

    const messages = await getMessages('c1', 10)
    expect(messages.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('saves and reads conversation lists', async () => {
    await saveConversationList([
      { id: 'c1', contact_name: 'Sara' },
      { id: 'c2', contact_name: 'Ahmed' },
    ])
    const list = await getConversationList()
    expect(list?.map((row) => row.id)).toEqual(['c1', 'c2'])
  })

  it('enqueues outgoing and flushes via sendFn', async () => {
    await enqueueOutgoing({
      client_id: 'client-1',
      conversation_id: 'c1',
      content: 'queued',
    })
    await enqueueOutgoing({
      client_id: 'client-2',
      conversation_id: 'c1',
      content: 'also queued',
    })

    const sendFn = vi.fn(async () => undefined)
    const result = await flushOutbox(sendFn)
    expect(result).toEqual({ sent: 2, failed: 0 })
    expect(sendFn).toHaveBeenCalledTimes(2)

    const second = await flushOutbox(sendFn)
    expect(second).toEqual({ sent: 0, failed: 0 })
    expect(sendFn).toHaveBeenCalledTimes(2)
  })

  it('keeps outbox entries when sendFn fails', async () => {
    await enqueueOutgoing({
      client_id: 'client-fail',
      conversation_id: 'c1',
      content: 'nope',
    })
    const sendFn = vi.fn(async () => {
      throw new Error('offline')
    })
    const result = await flushOutbox(sendFn)
    expect(result).toEqual({ sent: 0, failed: 1 })

    const retry = vi.fn(async () => undefined)
    const recovered = await flushOutbox(retry)
    expect(recovered).toEqual({ sent: 1, failed: 0 })
  })

  it('preserves data across a version upgrade', async () => {
    await saveConversation({ id: 'c-upgrade', contact_name: 'Keep me' })
    await saveMessages([
      {
        id: 'm-upgrade',
        conversation_id: 'c-upgrade',
        content: 'persist',
        created_at: '2026-01-02T00:00:00Z',
      },
    ])
    await enqueueOutgoing({
      client_id: 'out-upgrade',
      conversation_id: 'c-upgrade',
      content: 'still here',
    })

    await __resetOfflineStoreForTests()
    const upgraded = await openInboxDbAtVersion(2)
    expect(upgraded.objectStoreNames.contains('conversations')).toBe(true)
    expect(upgraded.objectStoreNames.contains('messages')).toBe(true)
    expect(upgraded.objectStoreNames.contains('outbox')).toBe(true)
    expect(upgraded.objectStoreNames.contains('meta')).toBe(true)

    const conversation = await upgraded.get('conversations', 'c-upgrade')
    expect(conversation).toMatchObject({ id: 'c-upgrade', contact_name: 'Keep me' })
    const message = await upgraded.get('messages', 'm-upgrade')
    expect(message).toMatchObject({ id: 'm-upgrade', content: 'persist' })
    const outbox = await upgraded.get('outbox', 'out-upgrade')
    expect(outbox).toMatchObject({ client_id: 'out-upgrade', content: 'still here' })
    upgraded.close()
  })
})

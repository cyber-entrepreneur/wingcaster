/**
 * Cross-instance inbox event delivery via Postgres LISTEN/NOTIFY.
 * Proves that emitInboxEvent -> pg_notify -> LISTEN handler in a peer
 * process -> local broadcastInboxEvent completes end-to-end.
 *
 * Uses finPostgresSuite so a real Postgres instance backs the pool.
 */

import { describe, expect, it, afterEach, vi } from 'vitest'
import { finPostgresSuite } from '../fin/testing/suite.js'
import { emitInboxEvent, startInboxListener, stopInboxListener } from './inbox-events.js'

finPostgresSuite('inbox pg_notify fan-out', { seed: false }, () => {
  describe('emitInboxEvent -> LISTEN handler', () => {
    afterEach(async () => {
      await stopInboxListener()
    })

    it('delivers a published event to the LISTEN handler within 1s', async () => {
      const received = []
      const handler = (agentId, event) => {
        received.push({ agentId, event })
      }
      const client = await startInboxListener(handler)
      expect(client).not.toBeNull()

      await emitInboxEvent('agent-alpha', {
        type: 'message.new',
        conversation_id: 'conv-1',
        message_id: 'msg-1',
        payload: { id: 'msg-1', body: 'hello' },
      })

      const deadline = Date.now() + 1000
      while (Date.now() < deadline) {
        if (received.length > 0) break
        await new Promise((r) => setTimeout(r, 25))
      }

      expect(received).toHaveLength(1)
      expect(received[0]).toEqual({
        agentId: 'agent-alpha',
        event: {
          type: 'message.new',
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          payload: { id: 'msg-1', body: 'hello' },
        },
      })
    })

    it('drops malformed notifications without invoking the handler', async () => {
      const received = []
      await startInboxListener((agentId, event) => {
        received.push({ agentId, event })
      })

      // Publish a well-formed event to prove the listener is live,
      // then publish payloads the listener must reject.
      await emitInboxEvent('agent-beta', {
        type: 'conversation.updated',
        conversation_id: 'conv-2',
      })
      // Bypass the emit helper to send malformed payloads directly.
      const { getPool } = await import('../persistence/postgres-adapter.js')
      const pool = getPool()
      await pool.query('SELECT pg_notify($1, $2)', ['inbox_events', 'not-json'])
      await pool.query('SELECT pg_notify($1, $2)', ['inbox_events', JSON.stringify({ agentId: '', event: null })])

      const deadline = Date.now() + 1000
      while (Date.now() < deadline) {
        if (received.length >= 1) break
        await new Promise((r) => setTimeout(r, 25))
      }

      // Only the valid conversation.updated event should have been forwarded.
      expect(received).toHaveLength(1)
      expect(received[0].agentId).toBe('agent-beta')
      expect(received[0].event.type).toBe('conversation.updated')
    })

    it('emitInboxEvent swallows NOTIFY failures (best-effort)', async () => {
      // If pg_notify throws, emitInboxEvent must not propagate — realtime
      // delivery is best-effort by design. Poison the pool.query call and
      // assert the promise still resolves.
      const { getPool } = await import('../persistence/postgres-adapter.js')
      const querySpy = vi.spyOn(getPool(), 'query').mockRejectedValueOnce(new Error('boom'))

      await expect(
        emitInboxEvent('agent-gamma', {
          type: 'message.new',
          conversation_id: 'conv-3',
          message_id: 'msg-3',
        }),
      ).resolves.toBeUndefined()

      expect(querySpy).toHaveBeenCalledWith(
        'SELECT pg_notify($1, $2)',
        ['inbox_events', expect.stringContaining('conv-3')],
      )
      querySpy.mockRestore()
    })
  })
})

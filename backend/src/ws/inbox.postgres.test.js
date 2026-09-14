/**
 * WebSocket inbox fan-out coverage (Wave 8).
 * Filename kept as `.postgres.test.js` per dispatch; uses in-memory http + mocked auth.
 */

import http from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { attachInboxWebSocket, broadcastInboxEvent } from './inbox.js'

describe('inbox websocket', () => {
  /** @type {import('http').Server | null} */
  let server = null
  /** @type {import('ws').WebSocketServer | null} */
  let wss = null
  /** @type {import('ws').WebSocket | null} */
  let client = null

  afterEach(async () => {
    if (client) {
      try { client.terminate() } catch { /* ignore */ }
      client = null
    }
    if (wss) {
      await new Promise((resolve) => wss.close(() => resolve()))
      wss = null
    }
    if (server) {
      await new Promise((resolve) => server.close(() => resolve()))
      server = null
    }
  })

  it('broadcastInboxEvent delivers message.new within 500ms', async () => {
    server = http.createServer()
    wss = attachInboxWebSocket(server, {
      verifyAuth: async (token) => (token === 'good-token' ? { id: 'agent-1' } : null),
      heartbeatMs: 60_000,
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    const messages = []
    client = new WebSocket(`ws://127.0.0.1:${port}/ws/inbox?token=${encodeURIComponent('good-token')}`)

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('open timeout')), 2000)
      client.once('open', () => {
        clearTimeout(timer)
        resolve()
      })
      client.once('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    client.on('message', (data) => {
      try {
        messages.push(JSON.parse(String(data)))
      } catch {
        messages.push({ raw: String(data) })
      }
    })

    // Allow the server connection handler to register the socket + send connected.
    await new Promise((r) => setTimeout(r, 50))

    broadcastInboxEvent('agent-1', {
      type: 'message.new',
      conversation_id: 'conv-1',
      message_id: 'msg-1',
      payload: { id: 'msg-1', content: 'hello' },
    })

    const deadline = Date.now() + 500
    while (Date.now() < deadline) {
      if (messages.some((m) => m.type === 'message.new')) break
      await new Promise((r) => setTimeout(r, 20))
    }

    const event = messages.find((m) => m.type === 'message.new')
    expect(event).toEqual({
      type: 'message.new',
      conversation_id: 'conv-1',
      message_id: 'msg-1',
      payload: { id: 'msg-1', content: 'hello' },
    })
  })

  it('rejects upgrade without valid token', async () => {
    server = http.createServer()
    wss = attachInboxWebSocket(server, {
      verifyAuth: async () => null,
      heartbeatMs: 60_000,
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    await expect(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/inbox?token=bad`)
        ws.once('open', () => {
          ws.close()
          reject(new Error('should not open'))
        })
        ws.once('unexpected-response', (_req, res) => {
          resolve(res.statusCode)
        })
        ws.once('error', (err) => reject(err))
      }),
    ).resolves.toBe(401)
  })
})

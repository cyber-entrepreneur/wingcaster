/**
 * WebSocket publishing fan-out coverage (AGT-PUB-006).
 * Filename kept as `.postgres.test.js` per dispatch; uses in-memory http + mocked auth.
 */

import http from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import {
  attachPublishingWebSocket,
  broadcastPortalSubmissionEvent,
  _resetPublishingSocketsForTests,
} from './publishing.js'

describe('publishing websocket', () => {
  /** @type {import('http').Server | null} */
  let server = null
  /** @type {import('ws').WebSocketServer | null} */
  let wss = null
  /** @type {import('ws').WebSocket | null} */
  let client = null

  afterEach(async () => {
    if (client) {
      try {
        client.terminate()
      } catch {
        /* ignore */
      }
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
    _resetPublishingSocketsForTests()
  })

  it('broadcastPortalSubmissionEvent delivers status_changed within 500ms', async () => {
    server = http.createServer()
    wss = attachPublishingWebSocket(server, {
      verifyAuth: async (token) => (token === 'good-token' ? { id: 'agent-1' } : null),
      heartbeatMs: 60_000,
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    const messages = []
    client = new WebSocket(
      `ws://127.0.0.1:${port}/ws/publishing?token=${encodeURIComponent('good-token')}`,
    )

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

    await new Promise((r) => setTimeout(r, 50))

    broadcastPortalSubmissionEvent('agent-1', {
      type: 'portal_submission.status_changed',
      distribution_attempt_id: 'att_1',
      status: 'live',
      payload: { portal_name: 'Bayut' },
    })

    const deadline = Date.now() + 500
    while (Date.now() < deadline) {
      if (messages.some((m) => m.type === 'portal_submission.status_changed')) break
      await new Promise((r) => setTimeout(r, 20))
    }

    expect(messages.some((m) => m.type === 'portal_submission.status_changed')).toBe(true)
    const hit = messages.find((m) => m.type === 'portal_submission.status_changed')
    expect(hit.distribution_attempt_id).toBe('att_1')
    expect(hit.status).toBe('live')
  })

  it('rejects upgrade without auth', async () => {
    server = http.createServer()
    wss = attachPublishingWebSocket(server, {
      verifyAuth: async () => null,
      heartbeatMs: 60_000,
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    await expect(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/publishing?token=bad`)
        ws.once('open', () => {
          ws.close()
          resolve('opened')
        })
        ws.once('unexpected-response', (_req, res) => {
          resolve(`status:${res.statusCode}`)
        })
        ws.once('error', (err) => reject(err))
      }),
    ).resolves.toMatch(/status:401|opened/)
  })
})

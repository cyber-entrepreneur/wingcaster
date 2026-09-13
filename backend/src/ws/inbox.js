/**
 * Inbox realtime fan-out over WebSocket (`/ws/inbox`).
 * Auth: `?token=` query OR session cookie on the upgrade request.
 * Heartbeat: ping every 30s; close after 3 missed pongs.
 */

import { WebSocketServer } from 'ws'
import { verifyToken } from '../auth.js'
import { findUserById } from '../identity.js'
import { logger } from '../lib/logger.js'

/** @typedef {{ type: 'message.new' | 'message.updated' | 'conversation.updated', conversation_id: string, message_id?: string, payload?: unknown }} InboxWsEvent */

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const socketsByAgent = new Map()

const HEARTBEAT_MS = 30_000
const MAX_MISSED_PONGS = 3

/**
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function extractInboxWsToken(req) {
  const authHeader = String(req.headers?.authorization || '')
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim()
    if (bearer) return bearer
  }

  try {
    const url = new URL(req.url || '', 'http://localhost')
    const fromQuery = url.searchParams.get('token')
    if (fromQuery) return fromQuery
  } catch {
    // fall through to cookie
  }

  const cookieHeader = String(req.headers?.cookie || '')
  if (!cookieHeader) return ''

  const pairs = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean)
  const preferred = ['token', 'access_token', 'auth_token', 'session']
  for (const name of preferred) {
    const hit = pairs.find((part) => part.toLowerCase().startsWith(`${name}=`))
    if (!hit) continue
    const eq = hit.indexOf('=')
    let value = decodeURIComponent(hit.slice(eq + 1))
    if (value.toLowerCase().startsWith('bearer ')) value = value.slice(7).trim()
    if (value) return value
  }
  return ''
}

/**
 * @param {string} agentId
 * @param {import('ws').WebSocket} socket
 */
function trackSocket(agentId, socket) {
  let set = socketsByAgent.get(agentId)
  if (!set) {
    set = new Set()
    socketsByAgent.set(agentId, set)
  }
  set.add(socket)
}

/**
 * @param {string} agentId
 * @param {import('ws').WebSocket} socket
 */
function untrackSocket(agentId, socket) {
  const set = socketsByAgent.get(agentId)
  if (!set) return
  set.delete(socket)
  if (set.size === 0) socketsByAgent.delete(agentId)
}

/**
 * @param {string} agentId
 * @param {InboxWsEvent} event
 */
export function broadcastInboxEvent(agentId, event) {
  if (!agentId || !event?.type) return
  const set = socketsByAgent.get(agentId)
  if (!set || set.size === 0) return
  const body = JSON.stringify(event)
  for (const socket of set) {
    if (socket.readyState === 1) {
      try {
        socket.send(body)
      } catch (err) {
        logger.warn({ err: err?.message || String(err), agentId }, 'inbox ws send failed')
      }
    }
  }
}

/**
 * @param {import('http').Server} server
 * @param {{ verifyAuth?: (token: string) => Promise<{ id: string } | null>, heartbeatMs?: number }} [options]
 */
export function attachInboxWebSocket(server, options = {}) {
  const verifyAuth = options.verifyAuth || defaultVerifyAuth
  const heartbeatMs = Number(options.heartbeatMs || HEARTBEAT_MS)
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '', 'http://localhost')
      if (url.pathname !== '/ws/inbox') return

      const token = extractInboxWsToken(req)
      verifyAuth(token)
        .then((user) => {
          if (!user?.id) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
            socket.destroy()
            return
          }
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req, user)
          })
        })
        .catch(() => {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
        })
    } catch {
      socket.destroy()
    }
  })

  wss.on('connection', (ws, _req, user) => {
    const agentId = user.id
    ws.isAlive = true
    ws.missedPongs = 0
    trackSocket(agentId, ws)

    ws.on('pong', () => {
      ws.isAlive = true
      ws.missedPongs = 0
    })
    ws.on('close', () => untrackSocket(agentId, ws))
    ws.on('error', () => untrackSocket(agentId, ws))

    try {
      ws.send(JSON.stringify({ type: 'connected', payload: { agent_id: agentId } }))
    } catch {
      // ignore
    }
  })

  const heartbeat = setInterval(() => {
    for (const [agentId, set] of socketsByAgent.entries()) {
      for (const ws of [...set]) {
        if (!ws.isAlive) {
          ws.missedPongs = Number(ws.missedPongs || 0) + 1
          if (ws.missedPongs >= MAX_MISSED_PONGS) {
            try {
              ws.terminate()
            } catch {
              // ignore
            }
            untrackSocket(agentId, ws)
            continue
          }
        } else {
          ws.missedPongs = 0
        }
        ws.isAlive = false
        try {
          ws.ping()
        } catch {
          untrackSocket(agentId, ws)
        }
      }
    }
  }, heartbeatMs)

  if (typeof heartbeat.unref === 'function') heartbeat.unref()
  wss.on('close', () => clearInterval(heartbeat))
  return wss
}

/**
 * @param {string} token
 * @returns {Promise<{ id: string } | null>}
 */
async function defaultVerifyAuth(token) {
  if (!token) return null
  const decoded = verifyToken(token)
  if (!decoded?.id) return null
  const user = await findUserById(decoded.id)
  if (!user) return null
  return { id: user.id }
}

/**
 * Cross-instance inbox event bus over Postgres LISTEN/NOTIFY.
 *
 * Why: `broadcastInboxEvent` from ./inbox.js only reaches WebSocket clients
 * attached to the SAME Node process. In a horizontally-scaled deployment,
 * a message processed by instance A would never reach a client attached to
 * instance B. This module:
 *
 *   1. `emitInboxEvent(agentId, event)` publishes via `pg_notify('inbox_events', …)`
 *   2. `startInboxListener()` opens a dedicated pg client that `LISTEN`s on the
 *      same channel and forwards every payload to the local `broadcastInboxEvent`,
 *      so every instance's WebSocket clients receive events regardless of which
 *      instance originated them.
 *
 * The LISTEN client is a dedicated `pg.Client` (not from the pool) because
 * `LISTEN` holds the connection open indefinitely.
 */

import pg from 'pg'
import { resolveDatabaseUrl } from '../persistence/config.js'
import logger from '../lib/logger.js'
import { getPool } from '../persistence/postgres-adapter.js'
import { broadcastInboxEvent } from './inbox.js'

const CHANNEL = 'inbox_events'
const RECONNECT_DELAY_MS = 2000

let listenClient = null
let reconnectTimer = null
let currentHandler = null
let starting = null

function encode(agentId, event) {
  return JSON.stringify({ agentId, event })
}

/**
 * Publish an inbox event to every Node instance via Postgres.
 * Falls back to local-only delivery if NOTIFY fails, so a Postgres blip
 * does not drop events for clients on THIS instance.
 * @param {string} agentId
 * @param {import('./inbox.js').InboxWsEvent} event
 */
export async function emitInboxEvent(agentId, event) {
  if (!agentId || !event?.type) return
  try {
    await getPool().query('SELECT pg_notify($1, $2)', [CHANNEL, encode(agentId, event)])
  } catch (err) {
    logger.warn(
      { err: err?.message || String(err), agentId, eventType: event.type },
      'inbox pg_notify failed; delivering locally only',
    )
    try {
      broadcastInboxEvent(agentId, event)
    } catch {
      // best-effort — realtime is not a source of truth
    }
  }
}

/**
 * Start the LISTEN loop. Idempotent — repeated calls return the existing
 * client. Reconnects automatically on client errors or connection end.
 * @param {(agentId: string, event: import('./inbox.js').InboxWsEvent) => void} [handler]
 * @returns {Promise<import('pg').Client | null>}
 */
export function startInboxListener(handler = broadcastInboxEvent) {
  if (listenClient) return Promise.resolve(listenClient)
  if (starting) return starting
  currentHandler = handler
  const url = resolveDatabaseUrl({ throwOnMissing: false })
  if (!url) {
    logger.warn('inbox pg listener disabled: DATABASE_URL not set')
    return Promise.resolve(null)
  }

  starting = (async () => {
    const client = new pg.Client({
      connectionString: url,
      ssl: process.env.PG_SSL === 'false' ? false : undefined,
    })
    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL) return
      try {
        const parsed = JSON.parse(msg.payload || '{}')
        if (!parsed?.agentId || !parsed?.event?.type) return
        currentHandler(parsed.agentId, parsed.event)
      } catch (err) {
        logger.warn(
          { err: err?.message || String(err) },
          'inbox notification parse failed',
        )
      }
    })
    client.on('error', (err) => {
      logger.warn(
        { err: err?.message || String(err) },
        'inbox listen client error; scheduling reconnect',
      )
      scheduleReconnect()
    })
    client.on('end', () => {
      if (listenClient === client) scheduleReconnect()
    })

    try {
      await client.connect()
      await client.query(`LISTEN ${CHANNEL}`)
      listenClient = client
      return client
    } catch (err) {
      logger.warn(
        { err: err?.message || String(err) },
        'inbox LISTEN start failed; scheduling reconnect',
      )
      try {
        await client.end()
      } catch {
        // ignore
      }
      scheduleReconnect()
      return null
    }
  })()

  return starting.finally(() => {
    starting = null
  })
}

function scheduleReconnect() {
  if (reconnectTimer) return
  const doomed = listenClient
  listenClient = null
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    if (doomed) {
      try {
        await doomed.end()
      } catch {
        // ignore
      }
    }
    startInboxListener(currentHandler).catch(() => {
      // startInboxListener already schedules its own reconnect on failure
    })
  }, RECONNECT_DELAY_MS)
  if (typeof reconnectTimer.unref === 'function') reconnectTimer.unref()
}

/**
 * Stop the LISTEN loop (test teardown, graceful shutdown).
 */
export async function stopInboxListener() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  const client = listenClient
  listenClient = null
  currentHandler = null
  if (!client) return
  try {
    await client.query(`UNLISTEN ${CHANNEL}`)
  } catch {
    // ignore
  }
  try {
    await client.end()
  } catch {
    // ignore
  }
}

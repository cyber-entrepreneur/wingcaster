/**
 * Cross-instance publishing tracker event bus over Postgres LISTEN/NOTIFY.
 *
 * Channel: `portal_submission_events`
 * Payload: `{ agentId, event }` where event.type is
 * `portal_submission.status_changed`.
 */

import pg from 'pg'
import { resolveDatabaseUrl } from '../persistence/config.js'
import logger from '../lib/logger.js'
import { getPool } from '../persistence/postgres-adapter.js'
import { broadcastPortalSubmissionEvent } from './publishing.js'

export const PORTAL_SUBMISSION_EVENTS_CHANNEL = 'portal_submission_events'
const RECONNECT_DELAY_MS = 2000

let listenClient = null
let reconnectTimer = null
let currentHandler = null
let starting = null

function encode(agentId, event) {
  return JSON.stringify({ agentId, event })
}

/**
 * Publish a portal submission event to every Node instance via Postgres.
 * Falls back to local-only delivery if NOTIFY fails.
 *
 * @param {string} agentId
 * @param {import('./publishing.js').PublishingWsEvent} event
 */
export async function emitPortalSubmissionEvent(agentId, event) {
  if (!agentId || !event?.type) return
  try {
    await getPool().query('SELECT pg_notify($1, $2)', [
      PORTAL_SUBMISSION_EVENTS_CHANNEL,
      encode(agentId, event),
    ])
  } catch (err) {
    logger.warn(
      { err: err?.message || String(err), agentId, eventType: event.type },
      'publishing pg_notify failed; delivering locally only',
    )
    try {
      broadcastPortalSubmissionEvent(agentId, event)
    } catch {
      // best-effort — realtime is not a source of truth
    }
  }
}

/**
 * Start the LISTEN loop. Idempotent.
 * @param {(agentId: string, event: import('./publishing.js').PublishingWsEvent) => void} [handler]
 * @returns {Promise<import('pg').Client | null>}
 */
export function startPublishingListener(handler = broadcastPortalSubmissionEvent) {
  if (listenClient) return Promise.resolve(listenClient)
  if (starting) return starting
  currentHandler = handler
  const url = resolveDatabaseUrl({ throwOnMissing: false })
  if (!url) {
    logger.warn('publishing pg listener disabled: DATABASE_URL not set')
    return Promise.resolve(null)
  }

  starting = (async () => {
    const client = new pg.Client({
      connectionString: url,
      ssl: process.env.PG_SSL === 'false' ? false : undefined,
    })
    client.on('error', (err) => {
      logger.warn({ err: err?.message || String(err) }, 'publishing listen client error')
      scheduleReconnect()
    })
    client.on('end', () => {
      listenClient = null
      scheduleReconnect()
    })
    client.on('notification', (msg) => {
      if (msg.channel !== PORTAL_SUBMISSION_EVENTS_CHANNEL) return
      try {
        const parsed = JSON.parse(msg.payload || '{}')
        const agentId = parsed.agentId
        const event = parsed.event
        if (agentId && event?.type) {
          ;(currentHandler || handler)(agentId, event)
        }
      } catch (err) {
        logger.warn(
          { err: err?.message || String(err) },
          'publishing notify payload parse failed',
        )
      }
    })

    await client.connect()
    await client.query(`LISTEN ${PORTAL_SUBMISSION_EVENTS_CHANNEL}`)
    listenClient = client
    starting = null
    logger.info({ channel: PORTAL_SUBMISSION_EVENTS_CHANNEL }, 'publishing pg listener ready')
    return client
  })().catch((err) => {
    starting = null
    logger.warn({ err: err?.message || String(err) }, 'publishing pg listener start failed')
    scheduleReconnect()
    return null
  })

  return starting
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    listenClient = null
    starting = null
    startPublishingListener(currentHandler || broadcastPortalSubmissionEvent).catch(() => {})
  }, RECONNECT_DELAY_MS)
  if (typeof reconnectTimer.unref === 'function') reconnectTimer.unref()
}

/** Test helper — tear down listener. */
export async function _stopPublishingListenerForTests() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  starting = null
  const client = listenClient
  listenClient = null
  if (client) {
    try {
      await client.end()
    } catch {
      // ignore
    }
  }
}

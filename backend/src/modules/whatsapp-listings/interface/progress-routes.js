/**
 * Draft progress HTTP routes (BE-BLOCKER-13 / AGT-WLB-004).
 *
 * Canonical (brief) paths:
 *   GET|HEAD /api/whatsapp-listings/drafts/progress-capability
 *   GET|HEAD /api/whatsapp-listings/drafts/:sessionId/progress   (SSE)
 *   GET      /api/whatsapp-listings/drafts/:sessionId/state      (poll)
 *
 * Agent-prefixed aliases (same handlers, same auth):
 *   /api/agent/whatsapp-listings/drafts/...
 *
 * Auth: Bearer header preferred. EventSource may pass `?token=` as a fallback
 * because browsers cannot set Authorization on EventSource.
 */

import { authMiddleware } from '../../../auth.js'
import { Collections, findOneModule } from '../infrastructure/db.js'
import { draftProgressBus } from '../infrastructure/progress-bus.js'
import {
  buildFieldSnapshot,
  getProgressCapability,
  loadDraftProgressState,
  normalizeProgressMode,
  synthesizeEventsFromSnapshot,
} from '../application/draft-progress.js'

/**
 * Accept Authorization: Bearer … OR ?token= / ?access_token=
 * so EventSource clients can authenticate.
 */
export function authMiddlewareWithQueryToken(req, res, next) {
  if (!req.headers.authorization) {
    const token = req.query?.token || req.query?.access_token
    if (typeof token === 'string' && token.length) {
      req.headers.authorization = `Bearer ${token}`
    }
  }
  return authMiddleware(req, res, next)
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

async function loadOwnedSession(req) {
  const sessionId = req.params.sessionId
  const session = await findOneModule(Collections.SESSIONS, (s) => s.id === sessionId)
  if (!session) return { error: 404, body: { error: 'Session not found' } }
  if (session.agent_id !== req.user.id) {
    return { error: 403, body: { error: 'Forbidden' } }
  }
  let draft = null
  if (session.draft_id) {
    draft = await findOneModule(Collections.DRAFTS, (d) => d.id === session.draft_id)
  }
  return { session, draft }
}

function setCapabilityHeaders(res, capability) {
  res.setHeader('X-Draft-Progress-Mode', capability.mode)
  res.setHeader('X-Draft-Progress-SSE', capability.sse ? '1' : '0')
  res.setHeader('X-Draft-Progress-Poll', '1')
  res.setHeader('X-Draft-Progress-Poll-Interval-Ms', String(capability.poll_interval_ms))
}

export function registerProgressRoutes(app, { config, bus = draftProgressBus } = {}) {
  const capability = () => getProgressCapability(config)

  async function handleCapability(req, res) {
    const cap = capability()
    setCapabilityHeaders(res, cap)
    if (req.method === 'HEAD') return res.status(204).end()
    return res.json(cap)
  }

  async function handleProgressHead(req, res) {
    const cap = capability()
    setCapabilityHeaders(res, cap)
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    // Feature-flag: when poll-only, advertise unavailability so clients fall back.
    if (cap.mode === 'poll') {
      return res.status(404).end()
    }
    return res.status(200).end()
  }

  async function handleProgressSse(req, res) {
    const cap = capability()
    setCapabilityHeaders(res, cap)

    if (cap.mode === 'poll') {
      // Do not crash the client — return a clear JSON error so hooks degrade to poll.
      return res.status(404).json({
        error: 'SSE disabled',
        mode: 'poll',
        fallback: '/api/whatsapp-listings/drafts/:sessionId/state',
      })
    }

    let owned
    try {
      owned = await loadOwnedSession(req)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
    if (owned.error) return res.status(owned.error).json(owned.body)

    const { session, draft } = owned
    const sessionId = session.id

    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    if (typeof res.flushHeaders === 'function') res.flushHeaders()

    // Initial comment keeps some proxies from buffering an empty stream.
    res.write(`: connected ${sessionId}\n\n`)

    const snapshot = buildFieldSnapshot(session, draft)
    const buffered = bus.getBuffered(sessionId)
    const replay = buffered.length
      ? buffered
      : synthesizeEventsFromSnapshot(snapshot, { streamDescription: false })

    for (const event of replay) {
      writeSse(res, event.type, event)
    }

    if (snapshot.draft_ready) {
      // Already done — close after catch-up.
      res.end()
      return
    }

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping ${Date.now()}\n\n`)
    }, 15000)

    const unsubscribe = bus.subscribe(sessionId, (event) => {
      if (res.writableEnded) return
      writeSse(res, event.type, event)
      if (event.type === 'draft_ready' || event.type === 'error') {
        clearInterval(heartbeat)
        unsubscribe()
        // Allow the event to flush, then close.
        setTimeout(() => {
          if (!res.writableEnded) res.end()
        }, 10)
      }
    })

    const onClose = () => {
      clearInterval(heartbeat)
      unsubscribe()
    }
    req.on('close', onClose)
    req.on('aborted', onClose)
  }

  async function handleState(req, res) {
    const cap = capability()
    setCapabilityHeaders(res, cap)
    try {
      const owned = await loadOwnedSession(req)
      if (owned.error) return res.status(owned.error).json(owned.body)
      const snapshot = buildFieldSnapshot(owned.session, owned.draft)
      return res.json({
        ...snapshot,
        mode: cap.mode,
        poll_interval_ms: cap.poll_interval_ms,
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  const prefixes = ['/api/whatsapp-listings', '/api/agent/whatsapp-listings']

  for (const prefix of prefixes) {
    app.get(`${prefix}/drafts/progress-capability`, handleCapability)
    app.head(`${prefix}/drafts/progress-capability`, handleCapability)

    app.head(
      `${prefix}/drafts/:sessionId/progress`,
      authMiddlewareWithQueryToken,
      handleProgressHead,
    )
    app.get(
      `${prefix}/drafts/:sessionId/progress`,
      authMiddlewareWithQueryToken,
      handleProgressSse,
    )
    app.get(
      `${prefix}/drafts/:sessionId/state`,
      authMiddlewareWithQueryToken,
      handleState,
    )
  }

  // Expose for tests.
  return {
    normalizeProgressMode,
    loadDraftProgressState,
    capability,
  }
}

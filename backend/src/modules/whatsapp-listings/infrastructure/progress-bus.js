/**
 * In-process pub/sub for WhatsApp listing draft-field progress (BE-BLOCKER-13).
 *
 * Events are scoped by sessionId. Late subscribers can read a short ring buffer
 * of recent events so SSE catch-up works without a DB migration.
 */

import { EventEmitter } from 'node:events'

const DEFAULT_BUFFER = 64

/**
 * @typedef {'field_start'|'field_complete'|'field_stream'|'draft_ready'|'error'} ProgressEventType
 *
 * @typedef {{
 *   type: ProgressEventType,
 *   session_id: string,
 *   field?: string,
 *   value?: unknown,
 *   partial_text?: string,
 *   draft_id?: string|null,
 *   message?: string,
 *   ts: string,
 * }} ProgressEvent
 */

export function createProgressBus({ bufferSize = DEFAULT_BUFFER } = {}) {
  const emitter = new EventEmitter()
  emitter.setMaxListeners(200)
  /** @type {Map<string, ProgressEvent[]>} */
  const buffers = new Map()

  function channel(sessionId) {
    return `session:${sessionId}`
  }

  /**
   * @param {string} sessionId
   * @param {Omit<ProgressEvent, 'session_id'|'ts'> & { ts?: string }} event
   */
  function emit(sessionId, event) {
    if (!sessionId) return
    /** @type {ProgressEvent} */
    const payload = {
      ...event,
      session_id: sessionId,
      ts: event.ts || new Date().toISOString(),
    }
    const key = channel(sessionId)
    const buf = buffers.get(sessionId) || []
    buf.push(payload)
    while (buf.length > bufferSize) buf.shift()
    buffers.set(sessionId, buf)
    emitter.emit(key, payload)
    return payload
  }

  /**
   * @param {string} sessionId
   * @param {(event: ProgressEvent) => void} handler
   * @returns {() => void} unsubscribe
   */
  function subscribe(sessionId, handler) {
    const key = channel(sessionId)
    emitter.on(key, handler)
    return () => emitter.off(key, handler)
  }

  /** @param {string} sessionId */
  function getBuffered(sessionId) {
    return [...(buffers.get(sessionId) || [])]
  }

  /** @param {string} sessionId */
  function clear(sessionId) {
    buffers.delete(sessionId)
    emitter.removeAllListeners(channel(sessionId))
  }

  function reset() {
    buffers.clear()
    emitter.removeAllListeners()
  }

  return {
    emit,
    subscribe,
    getBuffered,
    clear,
    reset,
  }
}

/** Module singleton used by pipeline + HTTP routes in the same process. */
export const draftProgressBus = createProgressBus()

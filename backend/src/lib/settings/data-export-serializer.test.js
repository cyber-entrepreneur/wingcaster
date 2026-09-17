/**
 * Unit tests for T7 multi-format data-export serializers.
 *
 * Covers:
 *   - csvEscape: RFC-4180 handling of commas, quotes, newlines, null
 *   - rowsToCsv: header derived from union of keys, sorted alphabetically,
 *     empty input yields a stub, nested objects JSON-encoded
 *   - serializeJson: body is a Buffer, contentType is application/json,
 *     extension is 'json'
 *   - serializeZip: body is a Buffer starting with the ZIP magic bytes,
 *     contentType application/zip, extension 'zip'
 *   - serializeExport(format, payload): "zip" → zip, unknown → JSON fallback
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'

// T7 — archiver isn't installed in the test env (production dep, loaded at
// runtime). Mock it with a stub that records every `append(body, {name})`
// call so the ZIP-shape test can assert filenames + contents without a
// real archive. The mock also drives the 'data' → 'end' event sequence
// the serializer awaits.
const archiverMock = vi.hoisted(() => {
  const appendCalls = []
  const factory = vi.fn(() => {
    const emitter = new EventEmitter()
    emitter.append = (body, opts) => {
      appendCalls.push({
        body: typeof body === 'string' ? body : String(body),
        name: opts.name,
      })
    }
    emitter.finalize = async () => {
      emitter.emit('data', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))
      emitter.emit('end')
    }
    return emitter
  })
  return { default: factory, appendCalls, factory }
})
vi.mock('archiver', () => ({
  default: archiverMock.default,
}))

import {
  csvEscape,
  rowsToCsv,
  serializeExport,
  __testables,
} from './data-export-serializer.js'

const PAYLOAD = {
  export_format_version: 1,
  generated_at: '2026-09-16T10:00:00.000Z',
  data_subject: { user_id: 'u-1', email: 'a@b.com', name: 'Alice' },
  user: { id: 'u-1', name: 'Alice' },
  agent: { id: 'ag-1' },
  contacts: [
    { id: 'c-1', name: 'Bob', email: 'bob@example.com' },
    { id: 'c-2', name: 'Carol, Ms.', notes: 'She said "hello"' },
  ],
  opportunities: [{ id: 'o-1', value: 100 }],
  sessions: [{ id: 's-1', is_current: true }],
  backup_codes: [{ id: 'b-1', used_at: null }],
  activity_log: [{ id: 'a-1', type: 'listing_view' }],
  _notes: { excluded_fields: ['user.password_hash'] },
}

describe('csvEscape', () => {
  it('returns empty string for null/undefined', () => {
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })
  it('escapes commas by wrapping in quotes', () => {
    expect(csvEscape('Carol, Ms.')).toBe('"Carol, Ms."')
  })
  it('escapes double quotes by doubling them', () => {
    expect(csvEscape('She said "hi"')).toBe('"She said ""hi"""')
  })
  it('escapes newlines by wrapping', () => {
    expect(csvEscape('line one\nline two')).toBe('"line one\nline two"')
  })
  it('passes through plain strings + numbers', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape(42)).toBe('42')
  })
  it('serializes objects to JSON', () => {
    expect(csvEscape({ a: 1 })).toBe('{"a":1}')
  })
})

describe('rowsToCsv', () => {
  it('empty input → stub line so importers don\'t crash', () => {
    expect(rowsToCsv([])).toBe('empty\n')
    expect(rowsToCsv(null)).toBe('empty\n')
  })
  it('columns are union of all rows\' keys, sorted alphabetically', () => {
    const csv = rowsToCsv([
      { name: 'Alice', age: 30 },
      { name: 'Bob', city: 'NYC' },
    ])
    // Header alphabetical: age, city, name
    expect(csv.startsWith('age,city,name\n')).toBe(true)
  })
  it('escapes commas / quotes / newlines correctly', () => {
    const csv = rowsToCsv([{ note: 'has, comma' }])
    expect(csv).toContain('"has, comma"')
  })
})

describe('serializeJson', () => {
  it('returns Buffer + application/json + .json', () => {
    const result = __testables.serializeJson(PAYLOAD)
    expect(Buffer.isBuffer(result.body)).toBe(true)
    expect(result.contentType).toMatch(/application\/json/)
    expect(result.extension).toBe('json')
    const decoded = JSON.parse(result.body.toString('utf8'))
    expect(decoded.data_subject.email).toBe('a@b.com')
  })
})

describe('serializeZip', () => {
  beforeEach(() => {
    archiverMock.appendCalls.length = 0
    archiverMock.factory.mockClear()
  })

  it('emits the 7 expected entries with correct filenames', async () => {
    const result = await __testables.serializeZip(PAYLOAD)
    expect(Buffer.isBuffer(result.body)).toBe(true)
    expect(result.contentType).toBe('application/zip')
    expect(result.extension).toBe('zip')
    // ZIP file magic (stub emits PK\x03\x04)
    expect(result.body[0]).toBe(0x50)
    expect(result.body[1]).toBe(0x4b)

    const names = archiverMock.appendCalls.map((c) => c.name).sort()
    expect(names).toEqual([
      'activity_log.csv',
      'backup_codes.csv',
      'contacts.csv',
      'opportunities.csv',
      'profile.json',
      'request.json',
      'sessions.csv',
    ])
  })

  it('profile.json holds the data subject + notes; request.json holds chain of custody', async () => {
    await __testables.serializeZip(PAYLOAD)
    const profile = archiverMock.appendCalls.find((c) => c.name === 'profile.json')
    const parsed = JSON.parse(profile.body)
    expect(parsed.data_subject.email).toBe('a@b.com')
    expect(parsed._notes.excluded_fields).toContain('user.password_hash')

    const request = archiverMock.appendCalls.find((c) => c.name === 'request.json')
    const requestParsed = JSON.parse(request.body)
    expect(requestParsed.format).toBe('zip')
    expect(requestParsed.exported_at).toBe(PAYLOAD.generated_at)
  })

  it('contacts.csv preserves RFC-4180 escaping for commas and quotes', async () => {
    await __testables.serializeZip(PAYLOAD)
    const contacts = archiverMock.appendCalls.find((c) => c.name === 'contacts.csv')
    expect(contacts.body).toContain('"Carol, Ms."')
    expect(contacts.body).toContain('"She said ""hello"""')
  })
})

describe('serializeExport (dispatcher)', () => {
  it('format=zip → ZIP', async () => {
    const result = await serializeExport('zip', PAYLOAD)
    expect(result.extension).toBe('zip')
  })
  it('format=json → JSON', async () => {
    const result = await serializeExport('json', PAYLOAD)
    expect(result.extension).toBe('json')
  })
  it('unknown format → JSON (fallback, so a bad format never crashes worker)', async () => {
    const result = await serializeExport('turtle', PAYLOAD)
    expect(result.extension).toBe('json')
  })
  it('undefined format → JSON', async () => {
    const result = await serializeExport(undefined, PAYLOAD)
    expect(result.extension).toBe('json')
  })
})

